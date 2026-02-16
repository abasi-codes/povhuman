import { useTaskContext } from "../../context/TaskContext";

export function TaskCreator() {
  const { description, setDescription, webhookUrl, setWebhookUrl, taskId } = useTaskContext();

  if (taskId) return null;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-label">Task Creator</div>
      </div>
      <div className="field">
        <div className="field-label">Description</div>
        <textarea
          className="field-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What should the human do?"
        />
      </div>
      <div className="field">
        <div className="field-label">Webhook URL</div>
        <input
          className="field-input"
          type="text"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://your-agent.com/webhook"
        />
      </div>
    </div>
  );
}
