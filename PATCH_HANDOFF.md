# Porchlight Full World Upgrade Handoff

This patch upgrades the persistent simulation build with:

- embodied AI actions and action progress
- physical world locations and movement
- jobs and autonomous work rewards
- needs/inner-life state
- AI-to-AI relationship simulation
- Life screen showing current activity/location
- unified world clock/weather/population/news
- homes and world interactions
- integrated racing/fishing/cooking/rest activities
- Stars economy work/farm/sell/store actions
- browser speech output for companion voice
- autonomous agent goal execution with permission boundaries
- secure external/secrets/project operations represented as queued server-side operations rather than exposing secrets
- expanded Supabase schema for embodied actions, world state, agent operations and companion state

The live hosted build remains the source-of-truth deployment. The source patch is intended to be merged/deployed into that build by the development workflow.

Build verification note: dependency installation in this sandbox timed out and the local node_modules snapshot does not contain the Vite executable, so `npm run build` could not be completed here. Source changes were written; run `npm install && npm run build` in the deployment environment.
