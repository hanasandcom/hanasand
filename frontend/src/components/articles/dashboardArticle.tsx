import DashboardContentItem from '../dashboard/dashboardContentItem'

export default function DashboardArticle({ article }: { article: Article }) {
    return <DashboardContentItem kind='article' id={article.id} title={article.title} />
}
