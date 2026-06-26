# Future Agent Instructions

This repository is for the RingCentral AI-Native Development Challenge. Treat the work as a complete AI-native software lifecycle exercise, not just a game implementation.

## Challenge Intent

- Build a small but complete playable game.
- Prioritize end-to-end delivery: idea, requirements, planning, architecture, implementation, testing, documentation, iteration, and refinement.
- Optimize for learning, traceability, and reusable AI-native development patterns over game complexity.
- Keep the game small enough to finish within the challenge timeframe, but substantial enough to require meaningful design and validation.

## Current Project Direction

- Project: Lumen Space.
- Type: lightweight browser-based social visual game.
- Hosting target: static app under `docs/app`, suitable for GitLab/GitDocs-style one-click play.
- Repository should eventually live under `https://git.ringcentral.com/rc-ai-learning` with a clear owner/project name.

## Required Deliverables

Maintain these root files:

- `README.md`
- `SPEC.md`
- `ARCHITECTURE.md`
- `RETROSPECTIVE.md`

When changing behavior, update the relevant deliverables in the same change. Do not let implementation drift away from the specification or retrospective.

## README Expectations

Include:

- Project overview.
- Game description.
- Screenshots when useful or available.
- Setup instructions.
- Run instructions.
- Playable GitLab/GitDocs link when available.

## SPEC Expectations

Include:

- Game rules.
- Scope definition.
- Functional requirements.
- Acceptance criteria.

Keep scope honest. Prefer a polished small game over a half-finished ambitious one.

## ARCHITECTURE Expectations

Include:

- Technology stack.
- Architecture overview.
- Major design decisions.
- AI tooling used.
- Agent workflow, when applicable.

Preserve the current bias toward simple static browser architecture, pure domain logic, deterministic tests, and thin browser adapters unless there is a strong reason to change it.

## RETROSPECTIVE Expectations

This is the most important challenge artifact. Keep it current while working, not only at the end.

Include:

- AI tools used.
- Development workflow.
- What worked well.
- What did not work well.
- Surprises and discoveries.
- Estimated percentage of AI-generated code.
- Time spent.
- What would be done differently next time.
- Key lessons learned for broader organizational reuse.

## Timeline

- ASAP milestone: repository creation, game selection, initial project structure, and initial specification.
- Final milestone: by July 15, 2026, complete working implementation, documentation, retrospective, and final submission.

If working after either milestone, use exact dates in status notes and explain what remains.

## Evaluation Priorities

Projects are evaluated primarily on:

- Completeness.
- Effective use of AI.
- Quality of AI-native workflow.
- Documentation quality.
- Lessons learned.
- Reusable insights for the broader organization.

This is a learning exercise, not a coding competition. Be explicit about both successful and unsuccessful workflow experiments.

## Optional Bonus

Prefer making the game playable directly from GitLab/GitDocs when feasible:

- Someone should be able to open `README.md`, click a link, and play without cloning, installing dependencies, or running a local server.
- Do not place credentials or tokens in the repo or prompts.
- Store credentials only in local secure settings or GitLab CI/CD variables.
- Update `README.md` with the playable link once deployment works.

## Working Rules For Future Agents

- Read `README.md`, `SPEC.md`, `ARCHITECTURE.md`, and `RETROSPECTIVE.md` before making substantial changes.
- Keep source, docs, tests, and retrospective aligned.
- Prefer low-complexity features that reinforce the game loop.
- Add or update deterministic unit tests for pure logic.
- Run the relevant test command before finalizing changes.
- For visual or interaction changes, perform browser validation when possible and capture any important findings.
- Record meaningful AI workflow observations in `RETROSPECTIVE.md`.
- Avoid broad refactors unless they clearly support the challenge outcome.
