import { renderToStaticMarkup } from 'react-dom/server'
import { compileMDX } from 'next-mdx-remote/rsc'
import { describe, expect, it } from 'vitest'
import { Quiz, QuizChoice, QuizQuestion } from '../components/mdx/Quiz'
import { blogMdxOptions } from '../lib/blog-mdx-options'

describe('blog MDX quiz compilation', () => {
  it('preserves JSX expression attributes used by quiz configuration', async () => {
    const quizQuestions = Array.from({ length: 5 }, (_, index) => {
      const questionNumber = index + 1

      return `
  <QuizQuestion prompt="Question ${questionNumber}?">
    <QuizChoice correct>Correct ${questionNumber}</QuizChoice>
    <QuizChoice>Wrong ${questionNumber}</QuizChoice>
  </QuizQuestion>`
    }).join('\n')
    const { content } = await compileMDX({
      source: `<Quiz title="Compiled quiz" questionCount={2} randomizeChoices={true}>${quizQuestions}
</Quiz>`,
      components: {
        Quiz,
        QuizChoice,
        QuizQuestion
      },
      options: blogMdxOptions
    })

    const markup = renderToStaticMarkup(content)

    expect(markup).toContain('Question 1 of 2')
    expect(markup).not.toContain('Question 1 of 5')
  })
})
