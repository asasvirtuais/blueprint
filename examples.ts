// --- Example Usage ---

import { z } from "zod";
import { blueprint } from './index';

// Schemas for initial blueprint
const InitialPropsSchema = z.object({
    id: z.string(),
    name: z.string(),
    category: z.string().optional(), // Added optional for defaults example
});
type InitialProps = z.infer<typeof InitialPropsSchema>;

const InitialResultSchema = z.object({
    status: z.string(),
    data: z.object({ id: z.string(), name: z.string(), processedName: z.string(), category: z.string().optional() }),
});
type InitialResult = z.infer<typeof InitialResultSchema>;

// Create an initial blueprint
let bp1 = blueprint<InitialProps, InitialResult>({
    propsSchema: InitialPropsSchema,
    resultSchema: InitialResultSchema,
    description: "Simple Service BP V1"
}).setImplementation(async (props) => {
    if (props.name === "FAIL_ME") {
        throw new Error("Simulated failure in bp1 implementation");
    }
    return {
        status: "original_executed",
        data: {
            id: props.id,
            name: props.name,
            processedName: props.name.toUpperCase(),
            category: props.category || "default_category_in_impl"
        }
    };
});

async function runAllExamples() {
    console.log("--- Running Original Blueprint Examples (with fix in setImplementation) ---");
    // ... (original examples can be run here if needed, ensure bp1 is defined as above)

    console.log("\n\n--- Running Enforce and Defaults Examples ---");

    // --- Example for .enforce() ---
    console.log("\n--- Example 6: Using .enforce() ---");
    try {
        const bpEnforced = bp1.enforce({ category: "ENFORCED_CATEGORY" });
        // Now bpEnforced expects props: Omit<InitialProps, 'category'>
        // which is { id: string, name: string }

        console.log("Created enforced blueprint:", bpEnforced.description);
        console.log("Enforced BP Props Schema (simplified):", bpEnforced.propsSchema.describe(''));


        const resultEnforced = await bpEnforced({ id: "enforce-001", name: "Enforced Item" });
        console.log("✅ bpEnforced Call Result:", resultEnforced);
        if (resultEnforced.data.category !== "ENFORCED_CATEGORY") {
            console.error("❌ Enforcement failed! Category is:", resultEnforced.data.category);
        }

        // Example with function provider for enforce
        const bpEnforcedFn = bp1.enforce((props) => {
            console.log("[enforce fn] Received props:", props); // props are Omit<InitialProps, 'category'>
            // @ts-expect-error nothing important
            return { category: `ENFORCED_FROM_FN_${props.id}` };
        });
        const resultEnforcedFn = await bpEnforcedFn({id: "enforce-fn-002", name: "Enforced Item Fn"});
        console.log("✅ bpEnforcedFn Call Result:", resultEnforcedFn);


    } catch (e: any) {
        console.error("❌ Error during .enforce() example:", e.message, e.stack);
    }

    // --- Example for .defaults() ---
    console.log("\n--- Example 7: Using .defaults() ---");
    try {
        const bpWithDefaults = bp1.defaults({ category: "DEFAULT_CATEGORY", name: "Default Name" });
        // bpWithDefaults expects props: InitialProps, but `category` and `name` are effectively optional.
        // Type: Partial<Pick<InitialProps, "category" | "name">> & Omit<InitialProps, "category" | "name">
        // Which is { id: string, name?: string, category?: string }

        console.log("Created defaults blueprint:", bpWithDefaults.description);
        console.log("Defaults BP Props Schema (simplified):", bpWithDefaults.propsSchema.describe(''));


        // Call with all props (overriding default name, but not category)
        const resultDefaults1 = await bpWithDefaults({ id: "defaults-001", name: "Specific Name" });
        console.log("✅ bpWithDefaults Call (name provided, category default):", resultDefaults1);
        if (resultDefaults1.data.category !== "DEFAULT_CATEGORY" || resultDefaults1.data.name !== "Specific Name") {
             console.error("❌ Defaults scenario 1 failed!", resultDefaults1.data);
        }

        // Call with only id (using default name and category)
        const resultDefaults2 = await bpWithDefaults({ id: "defaults-002" });
        console.log("✅ bpWithDefaults Call (id provided, name & category default):", resultDefaults2);
         if (resultDefaults2.data.category !== "DEFAULT_CATEGORY" || resultDefaults2.data.name !== "Default Name") {
             console.error("❌ Defaults scenario 2 failed!", resultDefaults2.data);
        }

        // Call providing all, overriding all defaults
        const resultDefaults3 = await bpWithDefaults({ id: "defaults-003", name: "Override Name", category: "Override Category" });
        console.log("✅ bpWithDefaults Call (all provided, overriding defaults):", resultDefaults3);
        if (resultDefaults3.data.category !== "Override Category" || resultDefaults3.data.name !== "Override Name") {
             console.error("❌ Defaults scenario 3 failed!", resultDefaults3.data);
        }
        
        // Example with function provider for defaults
        const bpDefaultsFn = bp1.defaults(props => {
            console.log("[defaults fn] Received props:", props); // props are {id, name?, category?}
            return { category: `DEFAULT_FROM_FN_${props.id}` };
        });
        const resultDefaultsFn = await bpDefaultsFn({id: "default-fn-004", name: "Item Name"});
        console.log("✅ bpDefaultsFn Call Result:", resultDefaultsFn);


    } catch (e: any) {
        console.error("❌ Error during .defaults() example:", e.message, e.stack);
    }
}

// To run original examples (if you uncomment them in your local file):
// runSimplifiedExamples(); // This was the function from your initial code.

// To run new examples:
runAllExamples();
