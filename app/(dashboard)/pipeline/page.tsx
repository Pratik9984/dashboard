import { redirect } from "next/navigation";

export default function PipelineRedirectPage() {
  redirect("/leads");
  return null;
}
