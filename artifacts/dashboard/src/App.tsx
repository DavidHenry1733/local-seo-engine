import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectProvider } from "@/context/ProjectContext";
import DashboardPage from "@/pages/DashboardPage";
import WizardPage from "@/pages/WizardPage";
import PagesPage from "@/pages/PagesPage";
import ImagesPage from "@/pages/ImagesPage";
import DesignsPage from "@/pages/DesignsPage";
import RankingsPage from "@/pages/RankingsPage";
import HealthPage from "@/pages/HealthPage";
import CrawlPage from "@/pages/CrawlPage";
import SecurityPage from "@/pages/SecurityPage";
import TeamPage from "@/pages/TeamPage";
import PasswordPage from "@/pages/PasswordPage";
import CampaignDetailPage from "@/pages/CampaignDetailPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={WizardPage} />
      <Route path="/wizard" component={WizardPage} />
      <Route path="/pages" component={PagesPage} />
      <Route path="/images" component={ImagesPage} />
      <Route path="/designs" component={DesignsPage} />
      <Route path="/rankings" component={RankingsPage} />
      <Route path="/health" component={HealthPage} />
      <Route path="/crawl" component={CrawlPage} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/team" component={TeamPage} />
      <Route path="/password" component={PasswordPage} />
      <Route path="/campaign/:campaignId" component={CampaignDetailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
        <WouterRouter base={base}>
          <div className="flex h-screen flex-col overflow-hidden" style={{ background: "hsl(0 0% 97%)" }}>
            

<header className="flex items-center gap-2 px-4 h-14 shrink-0 overflow-x-auto"
style={{ background: "white", borderBottom: "1px solid hsl(220 16% 90%)" }}>
  <div className="text-sm font-bold mr-4 whitespace-nowrap" style={{ color: "hsl(220 20% 16%)" }}>
    InboxingPro SEO Engine
  </div>
  <a href="/api/dashboard#overview" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Overview</a>
  <a href="/api/dashboard#campaigns" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Campaigns</a>
  <a href="/api/dashboard#wizard" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Setup Wizard</a>
  <a href="/api/dashboard#distribution" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Distribution</a>
  <a href="/api/dashboard#visibility-posts" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>✨ Visibility Posts</a>
  <a href="/api/dashboard#qa" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Page QA</a>
  <a href="/api/dashboard#live-crawl" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Live Crawl</a>
  <a href="/api/dashboard#system-health" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>System Health</a>
  <a href="/api/dashboard#rankings" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Rankings</a>
  <a href="/api/dashboard#index" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Index Tracking</a>
  <a href="/api/dashboard#sitemaps" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Sitemaps</a>
  <a href="/api/dashboard#templates" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Templates</a>
  <a href="/api/dashboard#brand-import" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Brand Import</a>
  <a href="/api/dashboard#image-library" className="text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap" style={{ color: "hsl(217 80% 45%)" }}>Image Library</a>
</header>


            <main className="flex flex-1 flex-col overflow-hidden" style={{ background: "hsl(0 0% 97%)" }}>
              <Router />
            </main>
          </div>
        </WouterRouter>
      </ProjectProvider>
    </QueryClientProvider>
  );
}

export default App;
