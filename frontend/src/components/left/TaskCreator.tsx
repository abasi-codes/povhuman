import { useTaskContext } from "../../context/TaskContext";

export function TaskCreator() {
  const { description, setDescription, webhookUrl, setWebhookUrl, taskId } = useTaskContext();

  if (taskId) return null;

  return (
    <div className="card">
      <div className="card-title">Create Verification Task</div>
      <div className="form-group">
        <label className="form-label">Task Description</label>
        <textarea
          className="form-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what the human should do..."
          rows={3}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Webhook URL</label>
        <input
          type="text"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://your-agent.com/webhook"
        />
      </div>
    </div>
  );
}
