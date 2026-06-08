import { Html, Body, Container, Heading, Text, Hr } from 'react-email';

interface WelcomeEmailProps {
	name: string;
	email: string;
}

export function WelcomeEmail({ name, email }: WelcomeEmailProps) {
	return (
		<Html lang="en">
			<Body style={body}>
				<Container style={container}>
					<Heading style={heading}>Welcome aboard, {name}</Heading>
					<Hr style={divider} />
					<Text style={paragraph}>
						Your account has been created successfully. You&apos;re now signed in as{' '}
						<strong>{email}</strong>.
					</Text>
					<Text style={paragraph}>
						If you have any questions, just reply to this email — we&apos;re happy to
						help.
					</Text>
					<Hr style={divider} />
					<Text style={footer}>
						You received this email because you signed up for an account.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

const body: React.CSSProperties = {
	backgroundColor: '#f4f4f5',
	fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const container: React.CSSProperties = {
	maxWidth: '560px',
	margin: '40px auto',
	backgroundColor: '#ffffff',
	borderRadius: '8px',
	padding: '48px',
};

const heading: React.CSSProperties = {
	fontSize: '24px',
	fontWeight: '600',
	color: '#111827',
	margin: '0 0 24px',
};

const divider: React.CSSProperties = {
	borderColor: '#e5e7eb',
	margin: '24px 0',
};

const paragraph: React.CSSProperties = {
	fontSize: '15px',
	lineHeight: '1.6',
	color: '#374151',
	margin: '0 0 16px',
};

const footer: React.CSSProperties = {
	fontSize: '12px',
	color: '#9ca3af',
	margin: '0',
};
