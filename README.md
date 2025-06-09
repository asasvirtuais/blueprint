# Blueprint

Blueprint is a TypeScript library for intuitive function composition with late implementation, designed to reduce repetitive typing and streamline code reuse across different runtimes (frontend, backend, edge).

## Problem

As projects grow, they accumulate many helper functions that are combined into complex workflows. In TypeScript, this often leads to repetitive code, with many functions sharing similar parameter and return types. This repetition makes codebases harder to maintain and evolve.

## Solution

Blueprint introduces a new, intuitive approach to function composition, inspired by the `wretch` library. Instead of relying on the complex academic syntax of most functional programming libraries, Blueprint provides a builder-like API for composing functions. This makes it easy to share and reuse function parameters and return types across contexts, reducing boilerplate and unnecessary imports.

## Goal

- Avoid repetitive typing and redundant imports
- Enable seamless share of blueprints across runtimes
- Simplify the process of composing complex workflows
