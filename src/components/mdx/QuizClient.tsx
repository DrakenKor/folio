'use client'

import type { FormEvent } from 'react'
import { useEffect, useId, useMemo, useState } from 'react'
import { FiArrowRight, FiCheckCircle, FiRefreshCw } from 'react-icons/fi'

export interface QuizChoiceData {
  id: string
  text: string
  isCorrect: boolean
}

export interface QuizQuestionData {
  id: string
  prompt: string
  explanation?: string
  choices: QuizChoiceData[]
}

interface QuizClientProps {
  title?: string
  description?: string
  questions: QuizQuestionData[]
  questionCount?: number
  randomizeQuestions?: boolean
  randomizeChoices?: boolean
}

interface QuizRunOptions {
  questionCount?: number
  randomizeQuestions?: boolean
  randomizeChoices?: boolean
  random?: () => number
}

type SubmittedAnswers = Record<string, string>

function clampQuestionCount(questionCount: number | undefined, poolCount: number) {
  if (!questionCount) {
    return poolCount
  }

  return Math.min(Math.max(Math.floor(questionCount), 1), poolCount)
}

export function shuffleQuizItems<T>(
  items: readonly T[],
  random: () => number = Math.random
): T[] {
  const shuffledItems = [...items]

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffledItems[index], shuffledItems[swapIndex]] = [
      shuffledItems[swapIndex],
      shuffledItems[index]
    ]
  }

  return shuffledItems
}

export function buildQuizRun(
  questions: readonly QuizQuestionData[],
  {
    questionCount,
    randomizeQuestions = true,
    randomizeChoices = false,
    random = Math.random
  }: QuizRunOptions = {}
): QuizQuestionData[] {
  const selectableQuestions = randomizeQuestions
    ? shuffleQuizItems(questions, random)
    : [...questions]
  const selectedQuestions = selectableQuestions.slice(
    0,
    clampQuestionCount(questionCount, questions.length)
  )

  if (!randomizeChoices) {
    return selectedQuestions
  }

  return selectedQuestions.map((question) => ({
    ...question,
    choices: shuffleQuizItems(question.choices, random)
  }))
}

function getAnswerChoice(question: QuizQuestionData, answers: SubmittedAnswers) {
  return question.choices.find((choice) => choice.id === answers[question.id])
}

function getChoiceLetter(index: number) {
  return String.fromCharCode(65 + index)
}

export function QuizClient({
  title = 'Quiz',
  description,
  questions,
  questionCount,
  randomizeQuestions = true,
  randomizeChoices = false
}: QuizClientProps) {
  const questionGroupId = useId()
  const initialQuestions = useMemo(
    () =>
      buildQuizRun(questions, {
        questionCount,
        randomizeQuestions: false,
        randomizeChoices: false,
        random: () => 0
      }),
    [questionCount, questions]
  )
  const [quizQuestions, setQuizQuestions] = useState(initialQuestions)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<SubmittedAnswers>({})
  const [isFinished, setIsFinished] = useState(false)

  function startNewRun() {
    setQuizQuestions(
      buildQuizRun(questions, {
        questionCount,
        randomizeQuestions,
        randomizeChoices
      })
    )
    setCurrentQuestionIndex(0)
    setSelectedChoiceId(null)
    setAnswers({})
    setIsFinished(false)
  }

  useEffect(() => {
    startNewRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionCount, questions, randomizeChoices, randomizeQuestions])

  const currentQuestion = quizQuestions[currentQuestionIndex]
  const score = quizQuestions.reduce((total, question) => {
    const selectedChoice = getAnswerChoice(question, answers)

    return selectedChoice?.isCorrect ? total + 1 : total
  }, 0)
  const missedQuestions = quizQuestions.filter((question) => {
    const selectedChoice = getAnswerChoice(question, answers)

    return !selectedChoice?.isCorrect
  })
  const percentScore =
    quizQuestions.length > 0 ? Math.round((score / quizQuestions.length) * 100) : 0

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentQuestion || selectedChoiceId === null) {
      return
    }

    const nextAnswers = {
      ...answers,
      [currentQuestion.id]: selectedChoiceId
    }

    setAnswers(nextAnswers)
    setSelectedChoiceId(null)

    if (currentQuestionIndex === quizQuestions.length - 1) {
      setIsFinished(true)
      return
    }

    setCurrentQuestionIndex((index) => index + 1)
  }

  if (quizQuestions.length === 0) {
    return null
  }

  return (
    <section className="blog-quiz" aria-label={title}>
      <div className="blog-quiz-header">
        <div>
          <p className="blog-quiz-eyebrow">Interactive quiz</p>
          <h2 className="blog-quiz-title">{title}</h2>
          {description ? (
            <p className="blog-quiz-description">{description}</p>
          ) : null}
        </div>
        <div className="blog-quiz-pool">
          <span>{quizQuestions.length}</span>
          <small>of {questions.length} questions</small>
        </div>
      </div>

      {isFinished ? (
        <div className="blog-quiz-results" aria-live="polite">
          <div className="blog-quiz-score-card">
            <p className="blog-quiz-eyebrow">Score</p>
            <strong>
              {score} / {quizQuestions.length}
            </strong>
            <span>{percentScore}% correct</span>
          </div>

          <div className="blog-quiz-review">
            <h3>Missed questions</h3>
            {missedQuestions.length > 0 ? (
              <ol className="blog-quiz-review-list">
                {missedQuestions.map((question) => {
                  const selectedChoice = getAnswerChoice(question, answers)

                  return (
                    <li key={question.id} className="blog-quiz-review-item">
                      <p className="blog-quiz-review-prompt">{question.prompt}</p>
                      <dl>
                        <div>
                          <dt>Your answer</dt>
                          <dd>{selectedChoice?.text ?? 'No answer selected'}</dd>
                        </div>
                      </dl>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="blog-quiz-perfect">No missed questions.</p>
            )}
          </div>

          <button
            type="button"
            className="blog-quiz-button blog-quiz-button-secondary"
            onClick={startNewRun}>
            <FiRefreshCw aria-hidden="true" />
            Try another set
          </button>
        </div>
      ) : (
        <form className="blog-quiz-form" onSubmit={handleSubmit}>
          <div className="blog-quiz-progress-row">
            <span>
              Question {currentQuestionIndex + 1} of {quizQuestions.length}
            </span>
            <span>{Math.round(((currentQuestionIndex + 1) / quizQuestions.length) * 100)}%</span>
          </div>
          <div className="blog-quiz-progress" aria-hidden="true">
            <span
              style={{
                width: `${((currentQuestionIndex + 1) / quizQuestions.length) * 100}%`
              }}
            />
          </div>

          <fieldset className="blog-quiz-question">
            <legend>{currentQuestion.prompt}</legend>
            <div className="blog-quiz-choice-grid">
              {currentQuestion.choices.map((choice, index) => {
                const choiceInputId = `${questionGroupId}-${currentQuestion.id}-${choice.id}`
                const isSelected = selectedChoiceId === choice.id

                return (
                  <label
                    key={choice.id}
                    className={
                      isSelected
                        ? 'blog-quiz-choice is-selected'
                        : 'blog-quiz-choice'
                    }
                    htmlFor={choiceInputId}>
                    <input
                      id={choiceInputId}
                      type="radio"
                      name={`${questionGroupId}-${currentQuestion.id}`}
                      value={choice.id}
                      checked={isSelected}
                      onChange={() => setSelectedChoiceId(choice.id)}
                    />
                    <span className="blog-quiz-choice-marker" aria-hidden="true">
                      {getChoiceLetter(index)}
                    </span>
                    <span>{choice.text}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <button
            type="submit"
            className="blog-quiz-button"
            disabled={selectedChoiceId === null}>
            {currentQuestionIndex === quizQuestions.length - 1 ? (
              <>
                <FiCheckCircle aria-hidden="true" />
                Finish quiz
              </>
            ) : (
              <>
                <FiArrowRight aria-hidden="true" />
                Next question
              </>
            )}
          </button>
        </form>
      )}
    </section>
  )
}
