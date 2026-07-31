import { redirect } from "next/navigation";

// Task creation happens inline via TaskFormDialog on the list page — this
// redirect exists so the dashboard's "Create task" quick action and any
// deep link to /tasks/new still lands somewhere real instead of 404ing.
export default function NewTaskRedirect() {
  redirect("/tasks");
}
