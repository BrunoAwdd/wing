use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use candle_core::{Tensor, Device, DType};
use candle_transformers::models::bert::{BertModel, Config};
use candle_nn::VarBuilder;
use tokenizers::Tokenizer;

// Configura o hook de pânico para logs melhores no console do navegador
#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    Ok(())
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Entry {
    pub id: u32,
    pub text: String,
    pub embedding: Vec<f32>,
}

#[derive(Serialize, Deserialize)]
pub struct MemoryIndex {
    pub version: u8,
    pub dim: usize,
    pub entries: Vec<Entry>,
    pub next_id: u32,
}

#[wasm_bindgen]
pub struct WingMemoryEngine {
    index: MemoryIndex,
    model: Option<BertModel>,
    tokenizer: Option<Tokenizer>,
}

#[wasm_bindgen]
impl WingMemoryEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WingMemoryEngine {
        WingMemoryEngine {
            index: MemoryIndex {
                version: 1,
                dim: 384, // Default for all-MiniLM-L6-v2
                entries: Vec::new(),
                next_id: 0,
            },
            model: None,
            tokenizer: None,
        }
    }

    pub fn load_model(&mut self, weights: &[u8], config_json: &[u8]) -> Result<(), JsValue> {
        let device = Device::Cpu;
        let config: Config = serde_json::from_slice(config_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let vb = VarBuilder::from_slice_safetensors(weights, DType::F32, &device).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let model = BertModel::load(vb, &config).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.model = Some(model);
        Ok(())
    }

    pub fn load_tokenizer(&mut self, json: &[u8]) -> Result<(), JsValue> {
        let tokenizer = Tokenizer::from_bytes(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.tokenizer = Some(tokenizer);
        Ok(())
    }

    /// Ingests a list of text chunks.
    pub fn ingest(&mut self, texts: Vec<String>) -> Result<Vec<u32>, JsValue> {
        let mut ids = Vec::new();
        
        // Check if model is loaded
        if self.model.is_none() || self.tokenizer.is_none() {
             // Fallback to mock if no model or tokenizer
             for text in texts {
                let id = self.index.next_id;
                self.index.next_id += 1;
                let mock_embedding = vec![0.0; self.index.dim]; 
                let entry = Entry { id, text, embedding: mock_embedding };
                self.index.entries.push(entry);
                ids.push(id);
            }
            return Ok(ids);
        }

        let model = self.model.as_ref().unwrap();
        let tokenizer = self.tokenizer.as_ref().unwrap();
        let device = Device::Cpu;

        for text in texts {
            let id = self.index.next_id;
            self.index.next_id += 1;

            let tokens = tokenizer.encode(text.as_str(), true).map_err(|e| JsValue::from_str(&e.to_string()))?;
            let token_ids = Tensor::new(tokens.get_ids(), &device).map_err(|e| JsValue::from_str(&e.to_string()))?.unsqueeze(0).map_err(|e| JsValue::from_str(&e.to_string()))?;
            let token_type_ids = token_ids.zeros_like().map_err(|e| JsValue::from_str(&e.to_string()))?;

            let embeddings = model.forward(&token_ids, &token_type_ids, None).map_err(|e| JsValue::from_str(&e.to_string()))?;
            
            let (_n_sentence, n_tokens, _hidden_size) = embeddings.dims3().map_err(|e| JsValue::from_str(&e.to_string()))?;
            let embeddings = (embeddings.sum(1).map_err(|e| JsValue::from_str(&e.to_string()))? / (n_tokens as f64)).map_err(|e| JsValue::from_str(&e.to_string()))?;
            let embedding_vec = embeddings.squeeze(0).map_err(|e| JsValue::from_str(&e.to_string()))?.to_vec1::<f32>().map_err(|e| JsValue::from_str(&e.to_string()))?;

            let entry = Entry {
                id,
                text,
                embedding: embedding_vec,
            };

            self.index.entries.push(entry);
            ids.push(id);
        }
        Ok(ids)
    }

   /// Queries the vector store for similar chunks.
    pub fn query(&self, query_text: String, top_k: u8) -> Result<JsValue, JsValue> {
        if self.model.is_none() || self.tokenizer.is_none() {
            return Err(JsValue::from_str("Model or Tokenizer not loaded"));
        }

        let model = self.model.as_ref().unwrap();
        let tokenizer = self.tokenizer.as_ref().unwrap();
        let device = Device::Cpu;

        // 1. Embed the query
        let tokens = tokenizer.encode(query_text.as_str(), true).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let token_ids = Tensor::new(tokens.get_ids(), &device).map_err(|e| JsValue::from_str(&e.to_string()))?.unsqueeze(0).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let token_type_ids = token_ids.zeros_like().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let embeddings = model.forward(&token_ids, &token_type_ids, None).map_err(|e| JsValue::from_str(&e.to_string()))?;
        
        let (_n_sentence, n_tokens, _hidden_size) = embeddings.dims3().map_err(|e| JsValue::from_str(&e.to_string()))?;
        let embeddings = (embeddings.sum(1).map_err(|e| JsValue::from_str(&e.to_string()))? / (n_tokens as f64)).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let query_embedding = embeddings.squeeze(0).map_err(|e| JsValue::from_str(&e.to_string()))?.to_vec1::<f32>().map_err(|e| JsValue::from_str(&e.to_string()))?;

        // 2. Calculate Similarity
        let mut scores: Vec<(u32, f32)> = self.index.entries.iter()
            .map(|entry| {
                let score = cosine_similarity(&query_embedding, &entry.embedding);
                (entry.id, score)
            })
            .collect();

        // 3. Sort by score descending
        scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // 4. Return top K chunks
        let top_results: Vec<&Entry> = scores.iter()
            .take(top_k as usize)
            .filter_map(|(id, _)| self.index.entries.iter().find(|e| e.id == *id))
            .collect();

        serde_wasm_bindgen::to_value(&top_results).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn delete_chunk(&mut self, id: u32) {
        if let Some(pos) = self.index.entries.iter().position(|x| x.id == id) {
            self.index.entries.remove(pos);
        }
    }

    pub fn clear(&mut self) {
        self.index.entries.clear();
        self.index.next_id = 0;
    }
    pub fn serialize(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.index).unwrap()
    }

    pub fn load(&mut self, serialized: JsValue) -> Result<(), JsValue> {
        let index: MemoryIndex = serde_wasm_bindgen::from_value(serialized).map_err(|e| JsValue::from_str(&e.to_string()))?;
        
        if index.version != 1 {
             return Err(JsValue::from_str(&format!("Unsupported index version: {}", index.version)));
        }

        self.index = index;
        // Ensure next_id is correct after load (max id + 1)
        self.index.next_id = self.index.entries.iter().map(|e| e.id).max().unwrap_or(0) + 1;
        Ok(())
    }
}

fn cosine_similarity(v1: &[f32], v2: &[f32]) -> f32 {
    let dot_product: f32 = v1.iter().zip(v2.iter()).map(|(a, b)| a * b).sum();
    let norm_v1: f32 = v1.iter().map(|a| a * a).sum::<f32>().sqrt();
    let norm_v2: f32 = v2.iter().map(|a| a * a).sum::<f32>().sqrt();
    
    if norm_v1 == 0.0 || norm_v2 == 0.0 {
        return 0.0;
    }
    
    dot_product / (norm_v1 * norm_v2)
}

