import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { getAgentInitials, getTeamStats, shortenModel, STATUS_CONFIG } from '../../lib/utils'
import type { TeamData } from '../../types'

// ── Custom node types ──────────────────────────────────────────

function TeamNode({ data }: NodeProps) {
  const d = data as { label: string; description: string; stats: ReturnType<typeof getTeamStats> }
  return (
    <div className="min-w-[180px] rounded-2xl border-2 border-violet-500/60 bg-gradient-to-br
                    from-violet-500/20 to-purple-600/10 backdrop-blur-sm shadow-xl shadow-violet-500/20 px-4 py-3">
      <Handle type="source" position={Position.Right} className="!bg-violet-500 !border-violet-300" />
      <div data-sensitive className="font-bold text-sm text-white mb-1 truncate">{d.label}</div>
      <div data-sensitive className="text-xs text-violet-300 mb-2 line-clamp-1">{d.description}</div>
      <div className="flex gap-2 text-xs">
        <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
          {d.stats.completed} done
        </span>
        <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">
          {d.stats.inProgress} active
        </span>
      </div>
    </div>
  )
}

function AgentNode({ data }: NodeProps) {
  const d = data as { name: string; agentType: string; model: string; isLead: boolean }
  const initials = getAgentInitials(d.name)
  return (
    <div className={`min-w-[150px] rounded-xl border px-3 py-2.5 backdrop-blur-sm shadow-lg
                     ${d.isLead
                       ? 'border-violet-400/60 bg-violet-500/10 shadow-violet-500/10'
                       : 'border-zinc-500/40 bg-zinc-800/60 shadow-black/20'}`}>
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <Handle type="source" position={Position.Right} className="!bg-zinc-500" />
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0
                          ${d.isLead ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-zinc-600'}`}>
          {initials}
        </div>
        <div className="min-w-0">
          <div data-sensitive className="text-xs font-semibold text-white truncate">{d.name}</div>
          {d.isLead && <div className="text-xs text-violet-400">lead</div>}
        </div>
      </div>
      <div className="text-xs text-zinc-400 truncate">{d.agentType}</div>
      {d.model && (
        <div className="text-xs text-blue-400 font-mono truncate mt-0.5">{shortenModel(d.model)}</div>
      )}
    </div>
  )
}

function TaskNode({ data }: NodeProps) {
  const d = data as { subject: string; status: string; activeForm?: string }
  const cfg = STATUS_CONFIG[d.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
  return (
    <div className="min-w-[140px] max-w-[200px] rounded-xl border border-zinc-700/60 bg-zinc-900/80 px-3 py-2 shadow-md">
      <Handle type="target" position={Position.Left} className="!bg-zinc-600" />
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${d.status === 'in_progress' ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
      </div>
      <div data-sensitive className="text-xs text-zinc-300 line-clamp-2 leading-snug">
        {d.status === 'in_progress' && d.activeForm ? d.activeForm : d.subject}
      </div>
    </div>
  )
}

const nodeTypes = { team: TeamNode, agent: AgentNode, task: TaskNode }

// ── Build graph data ───────────────────────────────────────────

function buildGraph(teams: TeamData[], isDark: boolean) {
  const nodes: Node[] = []
  const edges: Edge[] = []

  const TEAM_X = 50
  const TEAM_Y_STEP = 260
  const AGENT_X = 320
  const TASK_X = 620
  let yOffset = 40

  teams.forEach((item) => {
    const stats = getTeamStats(item.tasks)
    const teamId = `team-${item.teamName}`

    nodes.push({
      id: teamId,
      type: 'team',
      position: { x: TEAM_X, y: yOffset },
      data: { label: item.team.name, description: item.team.description, stats },
    })

    const memberCount = item.team.members.length
    const agentBlockHeight = Math.max(memberCount * 80, 80)
    let agentY = yOffset - (agentBlockHeight / 2) + 40

    item.team.members.forEach((member) => {
      const agentId = `agent-${item.teamName}-${member.agentId}`
      nodes.push({
        id: agentId,
        type: 'agent',
        position: { x: AGENT_X, y: agentY },
        data: {
          name: member.name,
          agentType: member.agentType,
          model: member.model,
          isLead: member.agentId === item.team.leadAgentId,
        },
      })
      edges.push({
        id: `e-${teamId}-${agentId}`,
        source: teamId,
        target: agentId,
        animated: false,
        style: { stroke: isDark ? '#7c3aed80' : '#8b5cf6' },
      })
      agentY += 85
    })

    // Tasks: group by owner or just list
    const agentTaskMap = new Map<string, typeof item.tasks>()
    const unowned: typeof item.tasks = []
    item.tasks.forEach(task => {
      if (task.owner) {
        const arr = agentTaskMap.get(task.owner) ?? []
        arr.push(task)
        agentTaskMap.set(task.owner, arr)
      } else {
        unowned.push(task)
      }
    })

    let taskY = yOffset - 20
    item.tasks.forEach((task) => {
      const taskId = `task-${item.teamName}-${task.id}`
      nodes.push({
        id: taskId,
        type: 'task',
        position: { x: TASK_X, y: taskY },
        data: { subject: task.subject, status: task.status, activeForm: task.activeForm },
      })

      // Connect to owner agent if possible
      const ownerMember = item.team.members.find(m => m.name === task.owner)
      const sourceId = ownerMember
        ? `agent-${item.teamName}-${ownerMember.agentId}`
        : teamId
      edges.push({
        id: `e-${taskId}`,
        source: sourceId,
        target: taskId,
        animated: task.status === 'in_progress',
        style: {
          stroke: task.status === 'in_progress'
            ? (isDark ? '#3b82f6' : '#2563eb')
            : (isDark ? '#52525280' : '#a1a1aa'),
          strokeDasharray: task.status === 'pending' ? '4 3' : undefined,
        },
      })
      taskY += 75
    })

    yOffset += Math.max(agentBlockHeight + 80, item.tasks.length * 75 + 80, TEAM_Y_STEP)
  })

  // Add task dependency edges (blocks relationships)
  teams.forEach((item) => {
    for (const task of item.tasks) {
      if (!task.blocks || task.blocks.length === 0) continue
      for (const blockedId of task.blocks) {
        const sourceNodeId = `task-${item.teamName}-${task.id}`
        const targetNodeId = `task-${item.teamName}-${blockedId}`
        if (nodes.find(n => n.id === targetNodeId)) {
          edges.push({
            id: `dep-${sourceNodeId}-${targetNodeId}`,
            source: sourceNodeId,
            target: targetNodeId,
            style: { stroke: '#f97316', strokeWidth: 1.5, strokeDasharray: '4 3' },
            animated: false,
            label: 'blocks',
            labelStyle: { fontSize: 9, fill: '#f97316' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' },
          })
        }
      }
    }
  })

  return { nodes, edges }
}

// ── Main component ─────────────────────────────────────────────

interface Props {
  teams: TeamData[]
  isDark: boolean
  onSelectTeam?: (team: TeamData) => void
}

export function GraphView({ teams, isDark, onSelectTeam }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(teams, isDark),
    [teams, isDark]
  )

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const onInit = useCallback(() => {}, [])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    if (!onSelectTeam) return
    const match = node.id.match(/^team-(.+)$/)
    if (!match) return
    const found = teams.find(t => t.teamName === match[1])
    if (found) onSelectTeam(found)
  }, [teams, onSelectTeam])

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        colorMode={isDark ? 'dark' : 'light'}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={isDark ? '#ffffff15' : '#00000015'}
        />
        <Controls className="!bg-white/90 dark:!bg-zinc-900/90 !border-zinc-200 dark:!border-white/10 !rounded-xl overflow-hidden !shadow-lg" />
        <MiniMap
          className="!bg-white/90 dark:!bg-zinc-900/90 !border-zinc-200 dark:!border-white/10 !rounded-xl !shadow-lg"
          nodeColor={isDark ? '#7c3aed40' : '#8b5cf640'}
          maskColor={isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}
        />
      </ReactFlow>
    </div>
  )
}
