## ADDED Requirements

### Requirement: Sessions use their own workflow documents

Nereus SHALL scope workflow notes and continuation by session and SHALL resolve a bound session's progress from its explicit task document.

#### Scenario: Two active changes share a checkout

- **WHEN** two sessions bind different task files
- **THEN** each sees only its own progress, and a missing bound file yields no progress without releasing ownership

### Requirement: A work unit has one owner

Nereus SHALL reject a second session's claim on the same work unit and reject structured edits to a work unit owned by another session using the available edit hook.

#### Scenario: Simultaneous claims

- **WHEN** two sessions claim the same change in one checkout
- **THEN** at most one claim succeeds

### Requirement: Nereus archives the owned change

Nereus SHALL require the selected change to belong to the session, have completed tasks, and serialize archive operations through the commit that records their shared spec updates.

#### Scenario: One archive is already running

- **WHEN** another session tries to archive a different change
- **THEN** Nereus reports that archive is busy and retains both work claims
