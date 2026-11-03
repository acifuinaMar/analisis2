/** Une clases de Tailwind ignorando las vacías. */
export function cx(...clases: Array<string | false | null | undefined>): string {
    return clases.filter(Boolean).join(" ");
}
