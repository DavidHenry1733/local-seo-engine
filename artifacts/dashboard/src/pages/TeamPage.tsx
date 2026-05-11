import TopBar from "@/components/TopBar";

export default function TeamPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="Team" subtitle="Manage users and access" />
      <iframe
        src="/admin/users"
        className="flex-1 w-full border-0"
        style={{ minHeight: 0 }}
        title="Team management"
      />
    </div>
  );
}
