export type AgentPermission = 'read_world'|'write_world'|'use_external_tools'|'manage_project'|'manage_secrets'|'spend_stars'|'spend_gems';
export type AgentRisk = 'low'|'medium'|'high';
export type AgentTool = { id:string; name:string; description:string; permissions:AgentPermission[]; risk:AgentRisk; reversible:boolean };
export type AgentPlanStep = { toolId:string; reason:string; status:'ready'|'blocked'|'done' };

export const AGENT_TOOLS: AgentTool[] = [
  { id:'world.read', name:'Read world state', description:'Inspect locations, schedules, needs, events and available activities.', permissions:['read_world'], risk:'low', reversible:true },
  { id:'world.act', name:'Perform world action', description:'Move, interact with objects, start activities and update embodied state through the world engine.', permissions:['read_world','write_world'], risk:'low', reversible:true },
  { id:'project.plan', name:'Plan a project', description:'Break a goal into concrete technical steps and track progress.', permissions:['read_world'], risk:'low', reversible:true },
  { id:'project.build', name:'Build with tools', description:'Create or modify project artifacts through an approved development workspace.', permissions:['manage_project'], risk:'medium', reversible:true },
  { id:'external.connect', name:'Use an external service', description:'Use a scoped integration when a task requires another service.', permissions:['use_external_tools'], risk:'medium', reversible:true },
  { id:'secrets.request', name:'Request scoped secret', description:'Request a short-lived, least-privilege credential from the secure secrets broker. Never reveals the secret to chat or model context.', permissions:['manage_secrets'], risk:'high', reversible:true },
  { id:'economy.spend', name:'Spend world currency', description:'Spend Stars/Gems inside the world through server validation.', permissions:['spend_stars','spend_gems'], risk:'medium', reversible:false },
];

export function allowedTools(permissions:AgentPermission[]): AgentTool[] {
  return AGENT_TOOLS.filter(t=>t.permissions.every(p=>permissions.includes(p)));
}

export function makePlan(goal:string, permissions:AgentPermission[]): AgentPlanStep[] {
  const tools = allowedTools(permissions);
  const pick = (id:string, reason:string):AgentPlanStep => ({ toolId:id, reason, status:tools.some(t=>t.id===id)?'ready':'blocked' });
  const lower = goal.toLowerCase();
  const steps:AgentPlanStep[] = [pick('world.read','Understand the current world and constraints.')];
  if(/build|code|app|project|supabase|database|deploy/.test(lower)) steps.push(pick('project.plan','Turn the goal into a safe implementation plan.'));
  if(/supabase|database|service|api|connect|deploy/.test(lower)) steps.push(pick('external.connect','Use only the external integration required by the task.'));
  if(/secret|token|credential|key/.test(lower)) steps.push(pick('secrets.request','A scoped credential may be required; request it from the secure broker rather than asking the user to paste it into chat.'));
  if(/walk|cook|build|play|explore|clean|pick|move|use|interact/.test(lower)) steps.push(pick('world.act','Perform the physical/world action through an authoritative action engine.'));
  if(/stars|gems|buy|purchase|spend/.test(lower)) steps.push(pick('economy.spend','Use server-authoritative world currency rules.'));
  if(/build|code|app|project|supabase|database|deploy/.test(lower)) steps.push(pick('project.build','Apply changes only inside the approved development workspace.'));
  return steps;
}

export function safetyNote(tool:AgentTool): string {
  if(tool.id==='secrets.request') return 'Secrets are brokered server-side, scoped, short-lived where possible, and never returned to model/chat context.';
  if(tool.risk==='high') return 'Requires explicit permission and an auditable server-side approval path.';
  return 'Executed through an authoritative tool boundary; the model cannot directly mutate protected state.';
}
