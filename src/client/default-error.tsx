export default function DefaultError({ statusCode, message }: { statusCode: number; message?: string }) {
    return (
        <main style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-family:system-ui,sans-serif">
            <h1 style="font-size:4rem;font-weight:700">{statusCode}</h1>
            <p style="color:#666">{message ?? 'An unexpected error occurred'}</p>
        </main>
    )
}
