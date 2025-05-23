import blueprint from "@/src";

export const helloBlueprint = blueprint<{ name: string }, { message: string }>({}).async()