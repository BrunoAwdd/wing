import { useState, useEffect } from "react";
import { LogEntry } from "../components/StatusBar";

/* global Word, Office */

interface WordInteractionProps {
  addLog: (message: string, type: LogEntry["type"]) => void;
}

export const useWordInteraction = ({ addLog }: WordInteractionProps) => {
  const [originalText, setOriginalText] = useState("Selecione um texto no documento para começar.");

  const handleSelectionChange = async () => {
    await Word.run(async (context) => {
      const range = context.document.getSelection();
      range.load("text");
      await context.sync();

      if (range.text.trim() !== "") {
        setOriginalText(range.text);
        addLog("Texto selecionado. Pronto para um comando.", "info");
      } else {
        setOriginalText("Selecione um texto no documento para começar.");
        addLog("Pronto.", "info");
      }
    });
  };

  const acceptSuggestion = async (textToInsert: string) => {
    await Word.run(async (context) => {
      const range = context.document.getSelection();
      range.insertText(textToInsert, Word.InsertLocation.replace);
      range.select();
      await context.sync();
    });
    addLog("Texto atualizado com sucesso!", "success");
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
    // Carrega a seleção inicial
    handleSelectionChange();
  }, []);

  return { originalText, setOriginalText, acceptSuggestion };
};
