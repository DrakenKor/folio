# Blog MDX Quiz Authoring

Posts live in this directory as `*.mdx` files. A quiz is written directly in a post with the curated MDX tags:

- `Quiz`
- `QuizQuestion`
- `QuizChoice`
- `QuizAnswer` as an alias for `QuizChoice`

## Basic Quiz

```mdx
<Quiz
  title="Scaling fundamentals"
  description="A quick check on the arithmetic from this post."
  questionCount={3}>
  <QuizQuestion
    id="qps-definition"
    prompt="What does QPS measure?"
    explanation="QPS means requests per second, not latency per request.">
    <QuizChoice>Latency per request</QuizChoice>
    <QuizChoice correct>Requests per second</QuizChoice>
    <QuizChoice>Daily active users</QuizChoice>
  </QuizQuestion>

  <QuizQuestion prompt="If 10 questions are written and questionCount is 3, how many appear in one run?">
    <QuizChoice correct>3</QuizChoice>
    <QuizChoice>7</QuizChoice>
    <QuizChoice>10</QuizChoice>
  </QuizQuestion>

  <QuizQuestion prompt="Which setting randomizes answer order?">
    <QuizChoice>`randomizeQuestions`</QuizChoice>
    <QuizChoice correct>`randomizeChoices`</QuizChoice>
    <QuizChoice>`questionCount`</QuizChoice>
  </QuizQuestion>
</Quiz>
```

## Configuration

`questionCount={3}` selects 3 questions from however many `QuizQuestion` tags are in the quiz. If you omit it, every question is shown.

`randomizeQuestions` defaults to `true`, so each run selects questions randomly from the pool. Set `randomizeQuestions={false}` when you want the written order.

`randomizeChoices` defaults to `false`, so choices stay in the order you wrote them. Set `randomizeChoices={true}` when answer order should shuffle too.

## Rules

Every `QuizQuestion` needs a `prompt`.

Every question needs at least two `QuizChoice` or `QuizAnswer` tags.

Mark exactly one choice as correct with the boolean `correct` prop.

Use `id` on questions when you want stable internal IDs. If you omit it, the build generates one from the prompt.

The quiz shows one question at a time. After the final submission, it displays the score and a review of missed questions.
