import blueprint from '@/src/index';
import { nextAddon, route } from '@/addons/next';

// Define a simple blueprint
const helloBlueprint = blueprint<{ name: string }, Promise<{ message: string }>>({})
  .implement(async ({ name }) => ({ message: `Hello, ${name}!` }));

// Apply the Next.js addon to create a route handler
export const GET = route(
  helloBlueprint.addon(nextAddon)
)
