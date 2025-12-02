import * as React from "react";
import {
  DefaultButton,
  PrimaryButton,
  TextField,
  Stack,
  Text,
  Dropdown,
  IDropdownOption,
  MessageBar,
  MessageBarType,
} from "@fluentui/react";

export interface CreateAgentPageProps {
  onBack: () => void;
  onAgentCreated?: () => void;
}

const categories: IDropdownOption[] = [
  { key: "Legal", text: "Legal" },
  { key: "Finance", text: "Finance" },
  { key: "Creative", text: "Creative" },
  { key: "Productivity", text: "Productivity" },
  { key: "Other", text: "Other" },
];

export const CreateAgentPage: React.FC<CreateAgentPageProps> = ({ onBack, onAgentCreated }) => {
  console.log("CreateAgentPage rendered. onAgentCreated exists:", !!onAgentCreated);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<string>("Other");
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: MessageBarType; text: string } | null>(null);

  const handleSubmit = async () => {
    console.log("handleSubmit called");
    if (!name || !systemPrompt) {
      // ...
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      console.log("Sending fetch request...");
      const response = await fetch("/api/extensions/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, systemPrompt }),
      });
      console.log("Fetch response received:", response.status);

      if (!response.ok) {
        throw new Error("Failed to create agent");
      }

      setMessage({ type: MessageBarType.success, text: "Agent created successfully!" });

      if (onAgentCreated) {
        console.log("Calling onAgentCreated from CreateAgentPage");
        onAgentCreated();
      } else {
        console.log("onAgentCreated is undefined in CreateAgentPage");
      }
      // No timeout or onBack() here. onAgentCreated handles the view switch.
    } catch (error) {
      console.error("Agent Creation Error:", error);
      // ...
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack tokens={{ childrenGap: 15 }} styles={{ root: { padding: 20 } }}>
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Text variant="xLarge">Create New Agent</Text>
        <DefaultButton onClick={onBack} iconProps={{ iconName: "Cancel" }}>
          Cancel
        </DefaultButton>
      </Stack>

      {message && (
        <MessageBar messageBarType={message.type} onDismiss={() => setMessage(null)}>
          {message.text}
        </MessageBar>
      )}

      <TextField
        label="Agent Name"
        placeholder="e.g., Senior Legal Advisor"
        required
        value={name}
        onChange={(_, val) => setName(val || "")}
      />

      <Dropdown
        label="Category"
        selectedKey={category}
        options={categories}
        onChange={(_, option) => setCategory((option?.key as string) || "Other")}
      />

      <TextField
        label="System Prompt (Persona)"
        placeholder="Describe how the agent should behave..."
        multiline
        rows={6}
        required
        value={systemPrompt}
        onChange={(_, val) => setSystemPrompt(val || "")}
      />

      <Stack horizontal tokens={{ childrenGap: 10 }}>
        <PrimaryButton
          onClick={handleSubmit}
          disabled={isSubmitting}
          text={isSubmitting ? "Creating..." : "Create Agent"}
        />
      </Stack>
    </Stack>
  );
};
