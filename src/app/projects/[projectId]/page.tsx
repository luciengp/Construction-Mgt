import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The Programme planner is the project's landing page; the KPI / payment-gate
// dashboard lives at /overview.
export default function ProjectHome({
  params,
}: {
  params: { projectId: string };
}) {
  redirect(`/projects/${params.projectId}/programme`);
}
