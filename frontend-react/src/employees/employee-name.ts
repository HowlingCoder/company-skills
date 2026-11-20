import { type Employee } from "../api/models";

/** "Firstname Lastname", as the name column shows it. */
export function fullName(
  employee: Pick<Employee, "firstname" | "lastname">,
): string {
  return `${employee.firstname} ${employee.lastname}`;
}

/**
 * Sort key of the name column: last name first, like the backend orders the rows,
 * although the column shows the first name first. Lower case, so "de Vries" sorts
 * next to "Dietrich" and not after "Zimmer".
 */
export function byLastname(
  employee: Pick<Employee, "firstname" | "lastname">,
): string {
  return `${employee.lastname} ${employee.firstname}`.toLocaleLowerCase();
}
