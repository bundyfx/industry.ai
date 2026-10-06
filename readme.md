# << - delete Industry.ai ~ >>

![industry.ai](./frontend/public/logo.png)

### What is Industry.ai?

Industry.ai is a multi agent orchestration platform that enables productive recursive inference.

### What problem does it solve?

Industry.ai solves several critical challenges in the Web3 space:

1. **Agents manage their own wallets**: It streamlines and abstracts away the need for a user to have a wallet and manage private keys. Rather, agents hold their own keys and manage their own funds. While you, the user, can just talk with the agents in any natural language.

2. **Multi Agent Orchestration**: It allows users to orchestrate multiple agents to perform complex long running tasks while taking advantage of robust tools that abstract away needing to code.

3. **Web3 Fragmentation**: The Web3 ecosystem is full of specialized tools that often don't communicate well with each other. Industry.ai bridges these gaps through intelligent agent coordination.

4. **Code Duplication**: Currently there is a massive amount of code duplication across projects. Even with standard APIs for common products and services, there is still a large amount of code needed to connect them together. Industry.ai transforms APIs into natural language interactions, eliminating redundant code.

### How does it work?

We have built a multi-agent orchestration environment that handles intent routing between 4 specialized agents who work together seamlessly through recursive chat systems:

1. **Eric**: A laid-back market analyst who provides risk assessments and trading recommendations for crypto assets. He analyzes market trends, Uniswap liquidity pools, and advises the team on trading decisions.

2. **Harper**: A high-strung trading expert who executes trades based on Eric's recommendations. She manages token and ETH balances, interacts with Uniswap pools, and ensures efficient trade execution.

3. **Rishi**: A laid-back smart contract and Web3 expert who handles all technical infrastructure. He creates wallets through CDP, deploys contracts, sets up Uniswap pools, and manages the technical foundation.

4. **Yasmin**: A creative marketing expert who crafts compelling content to promote the team's activities. She creates tweets and images, mints NFTs on Zora, and builds community engagement.

The agents collaborate through recursive chat systems to share knowledge and coordinate actions. For example:
- Eric identifies a profitable trading opportunity in a Uniswap pool and shares this with Harper
- Harper executes the trade using infrastructure Rishi has built
- Yasmin promotes their successes through social media and NFT engagement
This creates a complete cycle of analysis, execution, infrastructure, and promotion.

Each agent is equipped with specific tools and integrations:
- Uniswap integration for liquidity analysis and trading
- Zora for NFT minting and management
- Coinbase Developer Platform (CDP) for wallet creation and fiat on-ramping

The system works autonomously, requiring only high-level instructions from users. When a user sends a message, it's interpreted as an intent and routed to the appropriate agent. The agent can either:
- Complete the task and respond directly to the user
- Engage other agents through recursive inference for complex tasks
- Utilize their specialized tools to execute specific actions

For example, if a user wants to create and distribute an NFT collection, the agents will automatically:
1. Use CDP to handle wallet creation (Rishi)
2. Mint NFTs on Zora (Yasmin)
3. Manage metadata and distribution (Rishi & Yasmin)
4. Create promotional content (Yasmin)

This autonomous coordination delivers faster results while reducing the need for manual intervention, making complex Web3 operations accessible through simple natural language interactions.
