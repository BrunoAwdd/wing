import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  makeStyles,
  tokens,
  Button,
  Text,
  shorthands,
  Input,
  Spinner,
} from "@fluentui/react-components";
import ReactDOMServer from "react-dom/server";
import { ArrowLeft24Regular, Send24Regular } from "@fluentui/react-icons";
import { useDocumentChat, ChatMessage } from "../hooks/useDocumentChat";
import ReactMarkdown from "react-markdown";

const MAX_MESSAGE_CHARS = 4000;

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    ...shorthands.padding("8px"),
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    marginLeft: "8px",
  },
  chatContainer: {
    flexGrow: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    ...shorthands.padding("16px"),
  },
  centeredContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    height: "100%",
  },
  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  message: {
    ...shorthands.padding("8px", "12px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    maxWidth: "85%",
    wordWrap: "break-word",
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  modelMessage: {
    alignSelf: "flex-start",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  inputContainer: {
    display: "flex",
    ...shorthands.gap("8px"),
    ...shorthands.padding("16px"),
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  input: {
    width: "100%",
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    textAlign: "center",
  },
});

interface DocumentAnalysisPageProps {
  onBack: () => void;
  insertHtmlAtCursor: (html: string) => Promise<void>;
  isOnline: boolean;
  sessionToken: string | null;
  qualityLevel: string;
  accountEmail: string;
}

const DocumentAnalysisPage: React.FC<DocumentAnalysisPageProps> = ({
  onBack,
  insertHtmlAtCursor,
  isOnline,
  sessionToken,
  qualityLevel,
  accountEmail,
}) => {
  const styles = useStyles();
  const { messages, isLoading, error, startAnalysis, sendMessage, clearConversation, hasConversation } =
    useDocumentChat({ isOnline, sessionToken, qualityLevel, accountEmail });
  const [currentMessage, setCurrentMessage] = useState("");
  const messageEndRef = useRef<null | HTMLDivElement>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (currentMessage.trim()) {
      sendMessage(currentMessage);
      setCurrentMessage("");
    }
  };

  const handleInsert = (markdownContent: string) => {
    const html = ReactDOMServer.renderToStaticMarkup(<ReactMarkdown>{markdownContent}</ReactMarkdown>);
    insertHtmlAtCursor(html);
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Button icon={<ArrowLeft24Regular />} appearance="transparent" onClick={onBack} />
        <Text className={styles.headerTitle}>Análise de Documento</Text>
        {hasConversation && (
          <Button
            appearance="subtle"
            size="small"
            style={{ marginLeft: "auto" }}
            onClick={clearConversation}
          >
            Limpar conversa
          </Button>
        )}
      </div>

      <div className={styles.chatContainer}>
        {!hasConversation ? (
          <div className={styles.centeredContainer}>
            {isLoading ? (
              <>
                <Spinner />
                <Text>Analisando seu documento...</Text>
              </>
            ) : (
              <>
                <Text>Inicie uma conversa sobre o conteúdo do seu documento.</Text>
                <Button appearance="primary" onClick={startAnalysis}>
                  Iniciar Análise
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className={styles.messageList}>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`${styles.message} ${msg.author === "user" ? styles.userMessage : styles.modelMessage}`}
              >
                <ReactMarkdown>{msg.content}</ReactMarkdown>
                {msg.author === "model" && (
                  <Button
                    size="small"
                    appearance="subtle"
                    onClick={() => handleInsert(msg.content)}
                    style={{ marginTop: "8px" }}
                  >
                    Inserir
                  </Button>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.author === "user" && (
              <div className={`${styles.message} ${styles.modelMessage}`}>
                <Spinner size="tiny" />
              </div>
            )}
            <div ref={messageEndRef} />
          </div>
        )}
        {error && <div className={styles.errorText}>{error}</div>}
      </div>

      {hasConversation && (
        <div className={styles.inputContainer}>
          <Input
            className={styles.input}
            placeholder="Digite sua pergunta..."
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isLoading}
            maxLength={MAX_MESSAGE_CHARS}
          />
          <Button
            icon={<Send24Regular />}
            appearance="primary"
            onClick={handleSend}
            disabled={isLoading || !currentMessage.trim()}
          />
        </div>
      )}
    </div>
  );
};

export default DocumentAnalysisPage;
