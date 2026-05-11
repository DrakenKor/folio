import type { ReactNode } from 'react'
import React from 'react'
import { slugifyHeading } from '@/lib/blog-helpers'
import { QuizClient, type QuizChoiceData, type QuizQuestionData } from './QuizClient'

interface QuizProps {
  title?: string
  description?: string
  questionCount?: number | string
  randomizeQuestions?: boolean | string
  randomizeChoices?: boolean | string
  children?: ReactNode
}

interface QuizQuestionProps {
  id?: string
  prompt?: string
  explanation?: string
  children?: ReactNode
}

interface QuizChoiceProps {
  id?: string
  correct?: boolean | string
  children?: ReactNode
}

function isNonEmptyTextNode(value: ReactNode) {
  return (typeof value === 'string' || typeof value === 'number') && String(value).trim()
}

function getComponentName(type: unknown) {
  if (typeof type === 'string') {
    return type
  }

  if (typeof type === 'function') {
    const component = type as { displayName?: string; name?: string }

    return component.displayName ?? component.name ?? ''
  }

  if (typeof type === 'object' && type !== null && 'displayName' in type) {
    return String(type.displayName)
  }

  return ''
}

function isFragmentElement(
  child: ReactNode
): child is React.ReactElement<{ children?: ReactNode }> {
  return React.isValidElement<{ children?: ReactNode }>(child) && child.type === React.Fragment
}

function isQuizQuestionElement(
  child: ReactNode
): child is React.ReactElement<QuizQuestionProps> {
  return (
    React.isValidElement<QuizQuestionProps>(child) &&
    (child.type === QuizQuestion || getComponentName(child.type) === 'QuizQuestion')
  )
}

function isQuizChoiceElement(
  child: ReactNode
): child is React.ReactElement<QuizChoiceProps> {
  if (!React.isValidElement<QuizChoiceProps>(child)) {
    return false
  }

  const componentName = getComponentName(child.type)

  return (
    child.type === QuizChoice ||
    child.type === QuizAnswer ||
    componentName === 'QuizChoice' ||
    componentName === 'QuizAnswer'
  )
}

function flattenChildren(children: ReactNode): ReactNode[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (isFragmentElement(child)) {
      return flattenChildren(child.props.children)
    }

    return child
  })
}

function extractTextContent(children: ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child)
      }

      if (React.isValidElement<{ children?: ReactNode }>(child)) {
        return extractTextContent(child.props.children)
      }

      return ''
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeBoolean(
  value: boolean | string | undefined,
  defaultValue: boolean
) {
  if (value === undefined) {
    return defaultValue
  }

  if (typeof value === 'boolean') {
    return value
  }

  const normalizedValue = value.trim().toLowerCase()

  if (normalizedValue === 'true') {
    return true
  }

  if (normalizedValue === 'false') {
    return false
  }

  throw new Error(`Invalid quiz boolean value "${value}". Use true or false.`)
}

function normalizeQuestionCount(value: number | string | undefined) {
  if (value === undefined) {
    return undefined
  }

  const numberValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new Error('Invalid quiz questionCount. Use a positive integer.')
  }

  return numberValue
}

function normalizeCorrectFlag(value: boolean | string | undefined) {
  return normalizeBoolean(value, false)
}

function getUniqueId(value: string | undefined, fallback: string, usedIds: Set<string>) {
  const baseId = slugifyHeading(value ?? fallback)
  let candidateId = baseId
  let suffix = 2

  while (usedIds.has(candidateId)) {
    candidateId = `${baseId}-${suffix}`
    suffix += 1
  }

  usedIds.add(candidateId)
  return candidateId
}

function assertQuizQuestionElement(
  child: ReactNode,
  quizName: string
): asserts child is React.ReactElement<QuizQuestionProps> {
  if (isQuizQuestionElement(child)) {
    return
  }

  if (isNonEmptyTextNode(child)) {
    throw new Error(
      `Invalid quiz "${quizName}": only QuizQuestion tags are allowed inside Quiz.`
    )
  }

  if (React.isValidElement(child)) {
    throw new Error(
      `Invalid quiz "${quizName}": only QuizQuestion tags are allowed inside Quiz.`
    )
  }
}

function assertQuizChoiceElement(
  child: ReactNode,
  quizName: string,
  questionPrompt: string
): asserts child is React.ReactElement<QuizChoiceProps> {
  if (isQuizChoiceElement(child)) {
    return
  }

  if (isNonEmptyTextNode(child)) {
    throw new Error(
      `Invalid quiz "${quizName}", question "${questionPrompt}": only QuizChoice tags are allowed inside QuizQuestion.`
    )
  }

  if (React.isValidElement(child)) {
    throw new Error(
      `Invalid quiz "${quizName}", question "${questionPrompt}": only QuizChoice tags are allowed inside QuizQuestion.`
    )
  }
}

export function extractQuizQuestions(
  children: ReactNode,
  quizName = 'Quiz'
): QuizQuestionData[] {
  const usedQuestionIds = new Set<string>()
  const questionElements = flattenChildren(children).filter((child) => {
    assertQuizQuestionElement(child, quizName)
    return isQuizQuestionElement(child)
  })

  const questions = questionElements.map((questionElement, questionIndex) => {
    const prompt = questionElement.props.prompt?.trim()

    if (!prompt) {
      throw new Error(
        `Invalid quiz "${quizName}": every QuizQuestion needs a prompt.`
      )
    }

    const choiceElements = flattenChildren(questionElement.props.children).filter(
      (child) => {
        assertQuizChoiceElement(child, quizName, prompt)
        return isQuizChoiceElement(child)
      }
    )
    const usedChoiceIds = new Set<string>()
    const choices: QuizChoiceData[] = choiceElements.map((choiceElement, choiceIndex) => {
      const text = extractTextContent(choiceElement.props.children)

      if (!text) {
        throw new Error(
          `Invalid quiz "${quizName}", question "${prompt}": every QuizChoice needs answer text.`
        )
      }

      return {
        id: getUniqueId(choiceElement.props.id, `choice-${choiceIndex + 1}`, usedChoiceIds),
        text,
        isCorrect: normalizeCorrectFlag(choiceElement.props.correct)
      }
    })

    if (choices.length < 2) {
      throw new Error(
        `Invalid quiz "${quizName}", question "${prompt}": add at least two choices.`
      )
    }

    if (choices.filter((choice) => choice.isCorrect).length !== 1) {
      throw new Error(
        `Invalid quiz "${quizName}", question "${prompt}": mark exactly one QuizChoice as correct.`
      )
    }

    return {
      id: getUniqueId(
        questionElement.props.id,
        questionElement.props.prompt ?? `question-${questionIndex + 1}`,
        usedQuestionIds
      ),
      prompt,
      explanation: questionElement.props.explanation?.trim() || undefined,
      choices
    }
  })

  if (questions.length === 0) {
    throw new Error(`Invalid quiz "${quizName}": add at least one QuizQuestion.`)
  }

  return questions
}

export function Quiz({
  title = 'Quiz',
  description,
  questionCount,
  randomizeQuestions,
  randomizeChoices,
  children
}: QuizProps) {
  const normalizedQuestionCount = normalizeQuestionCount(questionCount)
  const questions = extractQuizQuestions(children, title)

  return (
    <QuizClient
      title={title}
      description={description}
      questionCount={normalizedQuestionCount}
      questions={questions}
      randomizeQuestions={normalizeBoolean(randomizeQuestions, true)}
      randomizeChoices={normalizeBoolean(randomizeChoices, false)}
    />
  )
}

export function QuizQuestion(_props: QuizQuestionProps) {
  return null
}

export function QuizChoice(_props: QuizChoiceProps) {
  return null
}

export const QuizAnswer = QuizChoice
