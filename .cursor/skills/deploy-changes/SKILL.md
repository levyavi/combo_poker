---
name: deploy-changes
description: Deploys repository changes using the AppDeploy MCP tool, polling each deployment step until completion. Use when the user asks to deploy changes, says "deploy-changes", or requests an AppDeploy-based deployment workflow.
---

# Deploy Changes with AppDeploy

## When to use this skill

- The user says `deploy-changes`, "deploy changes", or similar.
- The user asks to deploy the latest code or modified files using AppDeploy.

## High-level behavior

When this skill is active and the user requests deployment:

1. Identify which files have changed.
2. Invoke the `AppDeploy` MCP tool (defined in the IDE as an MCP server tool) to deploy those changes.
3. Poll deployment status until the current step is complete.
4. If the deployment has multiple steps, do not start a later step until the previous step reports completion.

Always keep the user informed about which step is running and the current status.

## Detailed workflow

1. Determine the set of changed files
   - Prefer using git if available:
     - Run a status command (e.g. `git status --porcelain=v1`) in the project root.
     - Treat lines marked as modified, added, renamed, or deleted as "changed files".
   - Represent file paths relative to the project root when passing them to `AppDeploy`, unless its schema explicitly requires absolute paths.

2. Prepare and call `AppDeploy`
   - Inspect the `AppDeploy` MCP tool schema to understand its required parameters (e.g. list of files, target environment, app identifier).
   - Construct the payload so that it clearly indicates:
     - The list of changed files.
     - Any other required metadata (environment, service name, etc.), using project conventions or asking the user if the schema cannot be satisfied from context.
   - Call the `AppDeploy` tool to start a deployment.
   - Capture any deployment identifier, step information, or status handle returned by the tool; you will need this for polling.

3. Poll for deployment status
   - Use the schema of `AppDeploy` (or any associated status/describe tool) to determine how to query deployment status.
   - Poll at reasonable intervals rather than continuously (for example, every few seconds), balancing responsiveness with avoiding excessive calls.
   - After each poll:
     - Check whether the current step is `succeeded`, `failed`, or still `in_progress` (or equivalent status fields).
     - Report concise status updates back to the user.
   - **Do not** consider the step complete until the status explicitly indicates completion or failure.

4. Handle multi-step deployments
   - If the deployment consists of multiple steps (e.g. a sequence of phases or sub-tasks):
     - Start with the first step.
     - For that step, repeat the poll loop until it reaches a terminal status.
     - Only when the current step is complete should you:
       - Start the next step (using `AppDeploy` in whatever mode or parameters the schema defines), and
       - Begin polling the status for that next step.
   - Never launch multiple deployment steps in parallel unless the `AppDeploy` schema explicitly states that this is required.

5. Error handling
   - If any step fails:
     - Stop the remaining steps.
     - Retrieve and show any error messages or logs available from `AppDeploy`.
     - Clearly tell the user which step failed and, if possible, which files or sub-resources were involved.

6. User interaction and confirmation
   - If there is ambiguity about:
     - Which environment to deploy to (e.g. staging vs production), or
     - Which subset of changed files should be deployed,
     - Ask the user a brief, targeted clarification question before starting deployment.
   - Otherwise, proceed automatically once the user has issued a `deploy-changes`-style command.

7. Reporting completion
   - When all required deployment steps have completed successfully:
     - Summarize the deployment outcome for the user, including:
       - Which environment or target was deployed.
       - The final status of the deployment.
       - Any deployment identifiers (IDs) that might be useful for later reference.
   - If the deployment fails or is only partially complete, summarize the failure and suggest next possible actions (e.g. re-run a specific step after a fix).
