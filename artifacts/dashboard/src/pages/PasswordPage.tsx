import TopBar from "@/components/TopBar";

export default function PasswordPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="Change Password" subtitle="Update your login credentials" />
      <iframe
        src="/admin/change-password"
        className="flex-1 w-full border-0"
        style={{ minHeight: 0 }}
        title="Change password"
      />
    </div>
  );
}
