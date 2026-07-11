import { Html, Body, Container, Heading, Text, Hr, Button } from 'react-email';

interface PasswordChangedProps {
	name: string;
	loginUrl: string;
}

export function PasswordChanged({ name, loginUrl }: PasswordChangedProps) {
	return (
		<Html lang="en">
			<Body style={body}>
				<Container style={container}>
					<Heading style={heading}>Your password was changed</Heading>
					<Hr style={divider} />
					<Text style={paragraph}>Hi {name},</Text>
					<Text style={paragraph}>
						The password for your account was recently changed. If this was you, no
						further action is needed.
					</Text>
					<Button style={button} href={loginUrl}>
						Go to your account
					</Button>
					<Hr style={divider} />
					<Text style={footer}>
						If you didn&apos;t make this change, contact support immediately — your
						account may have been compromised.
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

const button: React.CSSProperties = {
	backgroundColor: '#111827',
	borderRadius: '6px',
	color: '#ffffff',
	fontSize: '15px',
	fontWeight: '600',
	padding: '12px 24px',
	textDecoration: 'none',
	display: 'inline-block',
};

const footer: React.CSSProperties = {
	fontSize: '12px',
	color: '#9ca3af',
	margin: '0',
};
