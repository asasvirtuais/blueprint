import { route } from '@/addons/next';
import { helloBlueprint } from '@/app/tools/hello';

// Define a simple blueprint
const routeBP = helloBlueprint.implement(async ({ name }) => ({ message: `Hello, ${name}!` }));

// Apply the Next.js addon to create a route handler
export const GET = route(
  routeBP
)
