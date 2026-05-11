import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Project {
  clientSlug: string;
  businessName: string;
  domain?: string;
}

interface ProjectContextValue {
  projects: Project[];
  selectedSlug: string;
  setSelectedSlug: (slug: string) => void;
  selectedProject: Project | undefined;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  selectedSlug: "",
  setSelectedSlug: () => {},
  selectedProject: undefined,
  isLoading: true,
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [selectedSlug, setSelectedSlugState] = useState<string>(() => {
    return localStorage.getItem("selectedSlug") ?? "";
  });

  const { data, isLoading } = useQuery<{ projects: Project[] }>({
    queryKey: ["projects"],
    queryFn: () => apiFetch<{ projects: Project[] }>("/api/projects"),
    staleTime: 30_000,
    retry: false,
  });

  const projects = data?.projects ?? [];

  useEffect(() => {
    if (!selectedSlug && projects.length > 0) {
      setSelectedSlugState(projects[0].clientSlug);
    }
  }, [projects, selectedSlug]);

  function setSelectedSlug(slug: string) {
    localStorage.setItem("selectedSlug", slug);
    setSelectedSlugState(slug);
  }

  const selectedProject = projects.find((p) => p.clientSlug === selectedSlug);

  return (
    <ProjectContext.Provider value={{ projects, selectedSlug, setSelectedSlug, selectedProject, isLoading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
