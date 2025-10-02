import { useState, useEffect, useCallback } from "react";
import { LogEntry } from "../components/StatusBar";

/* global Word, Office, crypto */

// A estrutura de dados agora usa texto puro
export interface Paragraph {
  id: string;
  text: string;
}

interface WordInteractionProps {
  addLog: (message: string, type: LogEntry["type"]) => void;
}

export const useWordInteraction = ({ addLog }: WordInteractionProps) => {
  const [originalText, setOriginalText] = useState<Paragraph[]>([]);

  const handleSelectionChange = useCallback(async () => {
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        const paragraphs = range.paragraphs;
        paragraphs.load("items/text"); // Carregamos apenas o texto
        await context.sync();

        if (paragraphs.items.length > 0 && paragraphs.items[0].text.trim() !== "") {
          const paragraphData: Paragraph[] = paragraphs.items.map(p => ({
            id: crypto.randomUUID(),
            text: p.text,
          }));

          setOriginalText(paragraphData);
          addLog(`${paragraphData.length} parágrafo(s) selecionado(s).`, "info");
        } else {
          setOriginalText([]);
          addLog("Selecione um texto para começar.", "info");
        }
      });
    } catch (error) {
      console.error("Erro em handleSelectionChange:", error);
      addLog("Erro ao processar a seleção do texto.", "error");
    }
  }, [addLog]);

  const acceptSuggestion = async (paragraphsToInsert: Paragraph[]) => {
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        const paragraphs = range.paragraphs;
        paragraphs.load("items");
        await context.sync();

        paragraphs.items.forEach((paragraph, i) => {
          if (paragraphsToInsert[i]) {
            // Usamos insertText, que preserva a formatação a nível de parágrafo
            paragraph.insertText(paragraphsToInsert[i].text, Word.InsertLocation.replace);
          }
        });
        
        await context.sync();
      });
      addLog("Texto atualizado com sucesso!", "success");
    } catch (error) {
      console.error("Erro em acceptSuggestion:", error);
      addLog("Erro ao inserir o texto sugerido.", "error");
    }
  };

  const insertAtCursor = async (textToInsert: string) => {
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        range.insertText(textToInsert, Word.InsertLocation.replace);
        await context.sync();
      });
      addLog("Texto do chat inserido no documento.", "success");
    } catch (error) {
      console.error("Erro em insertAtCursor:", error);
      addLog("Erro ao inserir o texto.", "error");
    }
  };

  useEffect(() => {
    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      handleSelectionChange,
      (result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          console.error("Falha ao registrar o handler de seleção: " + result.error.message);
        }
      }
    );
    handleSelectionChange();
  }, [handleSelectionChange]);

  return { originalText, acceptSuggestion, insertAtCursor };
};