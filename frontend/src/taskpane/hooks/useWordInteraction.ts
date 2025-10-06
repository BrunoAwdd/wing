import { useState, useEffect, useCallback, useRef } from "react";
import { LogEntry } from "../components/StatusBar";

/* global Word, Office */

export interface Paragraph {
  id: string;
  text: string;
}

interface WordInteractionProps {
  addLog: (message: string, type: LogEntry["type"]) => void;
}

const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
};

export const useWordInteraction = ({ addLog }: WordInteractionProps) => {
  const [originalText, setOriginalText] = useState<Paragraph[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const isUpdatingRef = useRef(isUpdating);
  isUpdatingRef.current = isUpdating;

  const handleSelectionChange = useCallback(async () => {
    if (isUpdatingRef.current) {
      addLog(`handleSelectionChange skipped due to isUpdatingRef.`, "info");
      return;
    }
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        const paragraphs = range.paragraphs;
        paragraphs.load("items/text");
        await context.sync();

        setOriginalText((prevOriginalText) => {
          if (paragraphs.items.length > 0 && paragraphs.items[0].text.trim() !== "") {
            const newText = paragraphs.items.map((p) => p.text).join("\n");
            const oldText = prevOriginalText.map((p) => p.text).join("\n");

            if (newText === oldText) {
              return prevOriginalText;
            }

            const paragraphData: Paragraph[] = paragraphs.items.map((p, i) => ({
              id: `${i}-${simpleHash(p.text)}`,
              text: p.text,
            }));
            addLog(`${paragraphData.length} parágrafo(s) selecionado(s).`, "info");
            return paragraphData;
          } else {
            if (prevOriginalText.length === 0) {
              return prevOriginalText;
            }
            addLog("Selecione um texto para começar.", "info");
            return [];
          }
        });
      });
    } catch (error) {
      console.error("Erro em handleSelectionChange:", error);
      addLog("Erro ao processar a seleção do texto.", "error");
    }
  }, [addLog]);

  const acceptAllSuggestions = async (paragraphsToInsert: Paragraph[]) => {
    isUpdatingRef.current = true;
    setIsUpdating(true);
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        const paragraphs = range.paragraphs;
        paragraphs.load("items");
        await context.sync();

        paragraphs.items.forEach((paragraph, i) => {
          if (paragraphsToInsert[i]) {
            paragraph.insertText(paragraphsToInsert[i].text, Word.InsertLocation.replace);
          }
        });

        await context.sync();
      });
      addLog("Texto atualizado com sucesso!", "success");
    } catch (error) {
      console.error("Erro em acceptAllSuggestions:", error);
      addLog("Erro ao inserir o texto sugerido.", "error");
    } finally {
      setTimeout(() => {
        isUpdatingRef.current = false;
        setIsUpdating(false);
      }, 300);
    }
  };

  const acceptSingleSuggestion = async (index: number, suggestionText: string) => {
    isUpdatingRef.current = true;
    setIsUpdating(true);
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        const paragraphs = range.paragraphs;
        paragraphs.load("items");
        await context.sync();

        if (paragraphs.items[index]) {
          paragraphs.items[index].insertText(suggestionText, Word.InsertLocation.replace);
        }

        await context.sync();
      });
      addLog("Sugestão aceita com sucesso!", "success");
    } catch (error) {
      console.error("Erro em acceptSingleSuggestion:", error);
      addLog("Erro ao aceitar a sugestão.", "error");
    } finally {
      setTimeout(() => {
        isUpdatingRef.current = false;
        setIsUpdating(false);
      }, 300);
    }
  };

  const acceptMultipleSuggestions = async (suggestions: { index: number; text: string }[]) => {
    isUpdatingRef.current = true;
    setIsUpdating(true);
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        const paragraphs = range.paragraphs;
        paragraphs.load("items");
        await context.sync();

        suggestions.forEach(({ index, text }) => {
          if (paragraphs.items[index]) {
            paragraphs.items[index].insertText(text, Word.InsertLocation.replace);
          }
        });

        await context.sync();
      });
      addLog("Sugestões aceitas com sucesso!", "success");
    } catch (error) {
      console.error("Erro em acceptMultipleSuggestions:", error);
      addLog("Erro ao aceitar as sugestões.", "error");
    } finally {
      setTimeout(() => {
        isUpdatingRef.current = false;
        setIsUpdating(false);
      }, 300);
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

  return { originalText, acceptAllSuggestions, acceptSingleSuggestion, acceptMultipleSuggestions, insertAtCursor, isUpdating };
};