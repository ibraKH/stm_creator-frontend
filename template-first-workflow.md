# Template-first Workflow and Matrix Layout

This document defines the initial design rules for the STM template layout and the template-first model creation workflow.

It covers:

- SCRUM-159: Matrix layout for templates
- SCRUM-160: Template-first workflow

---

## SCRUM-159: Matrix Layout for Templates

The template matrix layout is used to arrange state boxes in a consistent and predictable structure when a user loads an STM template.

The layout is based on two ecological condition dimensions:

1. **Overstory condition**
2. **Understory condition**

### Layout Rules

The horizontal axis represents **overstory condition**.

- Better overstory condition appears on the left.
- More degraded overstory condition appears towards the right.

The vertical axis represents **understory condition**.

- Better understory condition appears at the top.
- More degraded understory condition appears towards the bottom.

The worst combined condition should be placed in the **bottom-right corner**.

This means the bottom-right state represents both:

- poor overstory condition
- poor understory condition

### Matrix Structure

```text
                         Overstory condition
                  Better  -------------------->  Worse

Understory     +----------------+----------------+----------------+
Better         | State A        | State B        | State C        |
               | Good overstory | Mid overstory  | Poor overstory |
               +----------------+----------------+----------------+
               | State D        | State E        | State F        |
               | Good overstory | Mid overstory  | Poor overstory |
               +----------------+----------------+----------------+
Worse          | State G        | State H        | Worst State    |
               | Good overstory | Mid overstory  | Poor overstory |
               +----------------+----------------+----------------+
```

---

## Design Rationale

This layout helps users understand the template more quickly because ecological degradation is shown in a clear spatial direction.

The model becomes easier to read because:

- condition quality decreases from left to right for overstory
- condition quality decreases from top to bottom for understory
- the worst state is always in the same expected location
- users can compare states by their position in the matrix

This also makes different templates more consistent with each other.

---

## SCRUM-160: Template-first Workflow

The template-first workflow allows users to start from a predefined STM template instead of creating every state from an empty canvas.

This workflow is intended to reduce setup time and help users build models using a consistent structure.

### Workflow Overview

```text
Select template
      ↓
Load template onto canvas
      ↓
Review template states
      ↓
Delete irrelevant states
      ↓
Add or edit transitions
      ↓
Edit transition attributes
      ↓
Save customised model
```

### Detailed Workflow

#### 1. Select a Template

The user starts by selecting a predefined STM template.

The template may be based on vegetation type, ecological context, or a common modelling pattern.

#### 2. Load the Template

After the user selects a template, the system loads the template onto the canvas.

The states should be arranged using the matrix layout defined in SCRUM-159.

#### 3. Review Template States

The user reviews the generated states and checks whether each state is relevant to the current project.

Some templates may contain more states than are needed for a specific ecosystem or use case.

#### 4. Delete Irrelevant States

The user removes states that are not relevant to the current model.

This allows the template to act as a starting point, rather than a fixed structure.

#### 5. Add or Edit Transitions

After the relevant states have been kept, the user adds transitions between states.

The user may also edit existing transitions if the template includes default transitions.

#### 6. Edit Transition Attributes

For each transition, the user can edit transition details such as:

- transition driver
- likelihood
- time scale
- transition notes
- preconditions
- supporting evidence

#### 7. Save the Customised Model

Once the template has been adjusted, the user saves the customised model.

The saved result becomes a project-specific STM model based on the original template.

---

## Expected First-version Behaviour

For the first version, the template-first workflow should focus on a simple and reliable user path:

1. User selects a template.
2. System places template states on the canvas.
3. User deletes states that are not needed.
4. User adds or edits transitions.
5. User saves the customised model.

Advanced template editing features can be considered in later versions.

---

## Acceptance Notes

The design satisfies SCRUM-159 by defining:

- overstory condition arranged left to right
- understory condition arranged top to bottom
- worst combined state placed at the bottom-right corner

The design satisfies SCRUM-160 by defining:

- the template-first workflow
- the main user steps from loading a template to saving a customised model
- how users remove irrelevant states and add transitions