/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import {
  extractQuizQuestions,
  QuizChoice,
  QuizQuestion
} from '../components/mdx/Quiz'
import { buildQuizRun, QuizClient, type QuizQuestionData } from '../components/mdx/QuizClient'

const quizQuestions: QuizQuestionData[] = [
  {
    id: 'first-question',
    prompt: 'What does QPS measure?',
    explanation: 'QPS means requests per second.',
    choices: [
      {
        id: 'latency',
        text: 'Latency per request',
        isCorrect: false
      },
      {
        id: 'requests',
        text: 'Requests per second',
        isCorrect: true
      }
    ]
  },
  {
    id: 'second-question',
    prompt: 'Which value is a peak multiplier?',
    explanation: 'Peak multipliers estimate burst traffic above average load.',
    choices: [
      {
        id: 'ten-x',
        text: '10x',
        isCorrect: true
      },
      {
        id: 'ten-ms',
        text: '10ms',
        isCorrect: false
      }
    ]
  },
  {
    id: 'third-question',
    prompt: 'What should scaling estimates start with?',
    choices: [
      {
        id: 'arithmetic',
        text: 'Arithmetic',
        isCorrect: true
      },
      {
        id: 'themes',
        text: 'Themes',
        isCorrect: false
      }
    ]
  }
]

describe('MDX quiz components', () => {
  it('extracts validated quiz data from MDX-style tags', () => {
    const questions = extractQuizQuestions(
      <>
        <QuizQuestion
          id="qps"
          prompt="What does QPS measure?"
          explanation="QPS means requests per second.">
          <QuizChoice>Latency per request</QuizChoice>
          <QuizChoice correct>Requests per second</QuizChoice>
        </QuizQuestion>
      </>,
      'Scaling basics'
    )

    expect(questions).toEqual([
      {
        id: 'qps',
        prompt: 'What does QPS measure?',
        explanation: 'QPS means requests per second.',
        choices: [
          {
            id: 'choice-1',
            text: 'Latency per request',
            isCorrect: false
          },
          {
            id: 'choice-2',
            text: 'Requests per second',
            isCorrect: true
          }
        ]
      }
    ])
  })

  it('selects a configurable number of questions from the pool', () => {
    const run = buildQuizRun(quizQuestions, {
      questionCount: 2,
      randomizeQuestions: false
    })

    expect(run).toHaveLength(2)
    expect(run.map((question) => question.id)).toEqual([
      'first-question',
      'second-question'
    ])
  })

  it('shows one question at a time and reviews missed questions without revealing answers', () => {
    render(
      <QuizClient
        title="Scaling quiz"
        questions={quizQuestions}
        questionCount={2}
        randomizeQuestions={false}
      />
    )

    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
    expect(screen.getByText('What does QPS measure?')).toBeInTheDocument()
    expect(screen.queryByText('Which value is a peak multiplier?')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/latency per request/i))
    fireEvent.click(screen.getByRole('button', { name: /next question/i }))

    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
    expect(screen.getByText('Which value is a peak multiplier?')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/10x/i))
    fireEvent.click(screen.getByRole('button', { name: /finish quiz/i }))

    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('Missed questions')).toBeInTheDocument()
    expect(screen.getByText('What does QPS measure?')).toBeInTheDocument()
    expect(screen.getByText('Latency per request')).toBeInTheDocument()
    expect(screen.queryByText('Correct answer')).not.toBeInTheDocument()
    expect(screen.queryByText('Requests per second')).not.toBeInTheDocument()
    expect(screen.queryByText('QPS means requests per second.')).not.toBeInTheDocument()
  })
})
