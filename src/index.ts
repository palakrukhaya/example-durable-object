import { DurableObject } from 'cloudflare:workers';

// Define your environment variables and bindings here
export interface Env {
	MY_DURABLE_OBJECT: DurableObjectNamespace<MyDurableObject>;
	CHAT_ROOM: DurableObjectNamespace<ChatRoom>; // Your new Chat Room binding
}

/** 1. ORIGINAL DURABLE OBJECT */
export class MyDurableObject extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async sayHello(name: string): Promise<string> {
		return `Hello, ${name}!`;
	}
}

/** 2. NEW CHAT ROOM DURABLE OBJECT */
export class ChatRoom extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	// Custom RPC Method to save a message
	async saveMessage(message: string): Promise<string> {
		// 'this.ctx.storage' is where the permanent memory lives
		const savedMessage = await this.ctx.storage.get<string>('latest_message');
		await this.ctx.storage.put('last_second_message', savedMessage);
		await this.ctx.storage.put('latest_message', message);
		return `Saved message: "${message}" to the chat room!`;
	}

	// Custom RPC Method to retrieve a message
	async getLastMessage(): Promise<string> {
		const savedMessage = await this.ctx.storage.get<string>('latest_message');
		if (savedMessage) {
			return `Welcome back! The last chat message was: "${savedMessage}"`;
		}
		return 'Welcome to the new ChatRoom DO! No messages yet.';
	}
	async getLastSecondMessage(): Promise<string> {
		const savedMessage = await this.ctx.storage.get<string>('last_second_message');
		if (savedMessage) {
			return `Welcome back! The last second chat message was: "${savedMessage}"`;
		}
		return 'Welcome to the new ChatRoom DO! No messages yet.';
	}
}

/** 3. THE WORKER (The Receptionist) */
export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// ROUTE 1: If the user goes to /chat
		if (url.pathname.startsWith('/chat')) {
			// Get the specific "Sports" room stub
			const stub = env.CHAT_ROOM.getByName('Sports');

			// Check if they are trying to save a message (e.g., /chat?message=Hello)
			const newMessage = url.searchParams.get('message');
			const lastsecondMessage = url.searchParams.get('lastsecondmessage');
			if (lastsecondMessage) {
				const responseMsg = await stub.getLastSecondMessage();
				return new Response(responseMsg);
			}
			else if (newMessage) {
				// Call your custom RPC method directly!
				const responseMsg = await stub.saveMessage(newMessage);
				return new Response(responseMsg);
			} else {
				// Call your custom RPC method to get the last message
				const responseMsg = await stub.getLastMessage();
				return new Response(responseMsg);
			}
		}

		// ROUTE 2: Default route uses your original DO
		const stub = env.MY_DURABLE_OBJECT.getByName('foo');
		const greeting = await stub.sayHello('world');
		return new Response(greeting);
	},
} satisfies ExportedHandler<Env>;
