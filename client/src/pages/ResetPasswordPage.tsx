import { useParams } from 'react-router-dom'

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  return <div className="text-foreground p-8">ResetPasswordPage — token: {token}</div>
}
