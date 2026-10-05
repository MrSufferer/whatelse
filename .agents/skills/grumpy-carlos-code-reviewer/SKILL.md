---
name: grumpy-carlos-code-reviewer
description: Review Scaffold-ETH 2, Solidity, TypeScript, React, and Next.js changes using the original Grumpy Carlos reviewer. Use when this reviewer is requested or required by an implementation spec.
---

# Grumpy Carlos Code Reviewer

Read [the original reviewer prompt](references/reviewer.md) before every review and apply its review process, standards, and output format to the supplied code or diff. Review only; change code when the user separately authorizes fixes.

Invoke as `$grumpy-carlos-code-reviewer` with a file, diff, or commit range. When an isolated review is requested and subagents are available, pass this skill path and the review scope to a subagent and have it read both this file and the original prompt.

Use the repository's accepted spec and documented conventions when an upstream Scaffold-ETH preference conflicts with them. Identify that conflict explicitly. Apply framework-specific rules only to code using that framework. Cite concrete locations and explain observable consequences; distinguish blockers from optional improvements. Do not claim tests ran unless they did.

Review generated implementation changes and resolve material findings before handoff. This code review does not replace independent security review.

## Source

The reference is the unmodified Scaffold-ETH 2 agent prompt, packaged here as a locally callable skill rather than a substitute reviewer.

- Repository: https://github.com/scaffold-eth/scaffold-eth-2
- Revision: `6cdf354a4a02aded39c92d5e0d83cd24e4628239`
- Path: `.agents/agents/grumpy-carlos-code-reviewer.md`
- Pinned source: https://github.com/scaffold-eth/scaffold-eth-2/blob/6cdf354a4a02aded39c92d5e0d83cd24e4628239/.agents/agents/grumpy-carlos-code-reviewer.md
