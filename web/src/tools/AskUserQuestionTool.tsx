// Borrowed from src/tools/AskUserQuestionTool/AskUserQuestionTool.tsx +
// prompt.ts — the Web port mirrors cc's question/options contract so the
// model emits the same input shape. cc collects answers through its
// permission UI (checkPermissions returns behavior:'ask'); the Web port
// has no permission UI yet (Phase 8), so call() simply echoes back the
// questions and any pre-supplied answers. A Phase 8 elicitation hook will
// populate `answers` before call() runs. renderToolUseMessage shows the
// questions being asked so the transcript is informative even before the
// answer UI is wired up.

import type { ReactNode } from 'react'
import { buildTool, type JSONSchema, type ToolDef, type ToolUseContext } from '../Tool.js'
import type { ToolResultBlock } from '../types/index.js'

export const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion'

export const DESCRIPTION =
  'Asks the user multiple choice questions to gather information, clarify ambiguity, understand preferences, make decisions or offer them choices.'

// Borrowed verbatim from src/tools/AskUserQuestionTool/prompt.ts — the
// model-facing guidance. The Web port omits the preview-format extension
// (cc appends PREVIEW_FEATURE_PROMPT based on a runtime format flag the
// Web port does not configure).
export const PROMPT = `Use this tool when you need to ask the user questions during execution. This allows you to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices as you work
4. Offer choices to the user about what direction to take.

Usage notes:
- Users will always be able to select "Other" to provide custom text input
- Use multiSelect: true to allow multiple answers to be selected for a question
- If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label
`

const questionOptionSchema: JSONSchema = {
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description:
        'The display text for this option that the user will see and select. Should be concise (1-5 words) and clearly describe the choice.',
    },
    description: {
      type: 'string',
      description:
        'Explanation of what this option means or what will happen if chosen.',
    },
  },
  required: ['label', 'description'],
  additionalProperties: false,
}

const questionSchema: JSONSchema = {
  type: 'object',
  properties: {
    question: {
      type: 'string',
      description: 'The complete question to ask the user.',
    },
    header: {
      type: 'string',
      description: 'Very short label displayed as a chip/tag (max 12 chars).',
    },
    options: {
      type: 'array',
      items: questionOptionSchema,
      minItems: 2,
      maxItems: 4,
      description: 'The available choices for this question. Must have 2-4 options.',
    },
    multiSelect: {
      type: 'boolean',
      default: false,
      description: 'Set to true to allow multiple selections.',
    },
  },
  required: ['question', 'header', 'options'],
  additionalProperties: false,
}

export type QuestionOption = {
  label: string
  description: string
}

export type Question = {
  question: string
  header: string
  options: QuestionOption[]
  multiSelect?: boolean
}

export type AskUserQuestionInput = {
  questions: Question[]
  answers?: Record<string, string>
}

export type AskUserQuestionOutput = {
  questions: Question[]
  answers: Record<string, string>
}

export const AskUserQuestionTool = buildTool({
  name: ASK_USER_QUESTION_TOOL_NAME,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  inputJSONSchema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: questionSchema,
        minItems: 1,
        maxItems: 4,
        description: 'Questions to ask the user (1-4 questions)',
      },
      answers: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'User answers collected by the permission component',
      },
    },
    required: ['questions'],
    additionalProperties: false,
  } as JSONSchema,
  isReadOnly: () => true,
  isConcurrencySafe: true,
  validateInput(input: AskUserQuestionInput) {
    const { questions } = input
    if (!Array.isArray(questions) || questions.length === 0) {
      return { result: false, message: 'At least one question is required.' }
    }
    // cc's UNIQUENESS_REFINE: question texts unique, option labels unique
    // within each question.
    const qTexts = questions.map(q => q.question)
    if (qTexts.length !== new Set(qTexts).size) {
      return {
        result: false,
        message: 'Question texts must be unique.',
      }
    }
    for (const q of questions) {
      const labels = q.options.map(o => o.label)
      if (labels.length !== new Set(labels).size) {
        return {
          result: false,
          message: `Option labels must be unique within each question (question: "${q.question}").`,
        }
      }
    }
    return { result: true }
  },
  async call(
    input: AskUserQuestionInput,
    _context: ToolUseContext,
  ): Promise<AskUserQuestionOutput> {
    // cc's call echoes questions + answers back. The Web port does the same;
    // the elicitation UI (Phase 8) will populate `answers` via the permission
    // flow before call() runs. Until then, answers defaults to empty.
    return {
      questions: input.questions,
      answers: input.answers ?? {},
    }
  },
  renderToolUseMessage(input: AskUserQuestionInput): ReactNode {
    const { questions } = input
    if (!questions || questions.length === 0) return null
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacer-8)',
          padding: 'var(--spacer-12)',
          borderRadius: 'var(--radius-8)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          fontFamily: 'var(--body-sm-font-family)',
          fontSize: 'var(--body-sm-font-size)',
          color: 'var(--color-foreground)',
          marginTop: 'var(--spacer-8)',
        }}
      >
        <span style={{ fontWeight: 'var(--font-weight-strong)' }}>
          Asking {questions.length} question{questions.length > 1 ? 's' : ''}
        </span>
        {questions.map((q, qi) => (
          <div
            key={qi}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacer-4)',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>{q.question}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacer-4)' }}>
              {q.options.map((opt, oi) => (
                <span
                  key={oi}
                  style={{
                    padding: 'var(--spacer-4) var(--spacer-8)',
                    borderRadius: 'var(--radius-4)',
                    background: 'var(--color-overlay-1)',
                    color: 'var(--color-foreground)',
                  }}
                >
                  {opt.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  },
  mapToolResultToToolResultBlockParam(
    output: AskUserQuestionOutput,
    toolUseId: string,
  ): ToolResultBlock {
    const answersText = Object.entries(output.answers)
      .map(([q, a]) => `"${q}"="${a}"`)
      .join(', ')
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `User has answered your questions: ${answersText}. You can now continue with the user's answers in mind.`,
    }
  },
} satisfies ToolDef<AskUserQuestionInput, AskUserQuestionOutput>)
