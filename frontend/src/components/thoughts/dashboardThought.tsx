import DashboardContentItem from '../dashboard/dashboardContentItem'

export default function DashboardThought({ thought }: { thought: Thought }) {
    return <DashboardContentItem kind='thought' id={thought.id} title={thought.title} />
}
