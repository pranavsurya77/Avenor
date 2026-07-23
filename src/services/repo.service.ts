import { prisma } from "../config/prisma.js";

export async function getOrCreateRepository(ownerName: string, repoName: string) {
    const userEmail = `${ownerName.toLowerCase()}@system.local`;

    let user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: userEmail },
                { name: ownerName }
            ]
        }
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                name: ownerName,
                email: userEmail
            }
        });
    }

    let repo = await prisma.repository.findUnique({
        where: {
            ownerId_name: {
                ownerId: user.id,
                name: repoName
            }
        }
    });

    if (!repo) {
        repo = await prisma.repository.create({
            data: {
                name: repoName,
                ownerId: user.id,
                url: `https://github.com/${ownerName}/${repoName}`
            }
        });
    }

    return repo;
}
