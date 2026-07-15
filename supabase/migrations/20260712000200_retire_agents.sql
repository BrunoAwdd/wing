-- RFC 016: Agents Hub, Maestro, Extensions and MCP were retired.
-- Keep the historical create migration intact for migration ordering, then
-- remove the obsolete table wherever an older environment may have created it.
drop table if exists wing.agents;
drop table if exists public.agents;
