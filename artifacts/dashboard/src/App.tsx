import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectProvider } from "@/context/ProjectContext";
import Sidebar from "@/components/Sidebar";
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
      <Route path="/" component={DashboardPage} />
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
          <div className="flex h-screen overflow-hidden" style={{ background: "hsl(0 0% 97%)" }}>
            <Sidebar />
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
