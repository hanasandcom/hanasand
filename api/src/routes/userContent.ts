import { getServiceAccounts, postServiceAccount, patchServiceAccount, deleteServiceAccount, serviceAccountSelf } from '../handlers/serviceAccounts.ts'
import { getProfileSshKeys, postProfileSshKey, deleteProfileSshKey } from '../handlers/profileSshKeys.ts'
import getUser from '../handlers/user/get.ts'
import { getProfileStats } from '../handlers/profileStats.ts'
import postPwned from '../handlers/pwned/post.ts'
import getArticles, { getArticle } from '../handlers/articles/get.ts'
import postArticle from '../handlers/articles/post.ts'
import putArticle from '../handlers/articles/put.ts'
import getTest from '../handlers/test/get.ts'
import postTest from '../handlers/test/post.ts'
import rerunTest from '../handlers/test/rerun.ts'
import { getMyRecentTests, getRecentTests } from '../handlers/test/list.ts'
import restartHandler from '../handlers/restart/getRestart.ts'
import putUser from '../handlers/user/putUser.ts'
import deleteUser from '../handlers/user/deleteUser.ts'
import deleteSelf from '../handlers/user/deleteSelf.ts'
import restoreSelf from '../handlers/user/restoreSelf.ts'
import authorizedUserHandler from '../handlers/user/fullUser.ts'
import getUsers from '../handlers/user/getUsers.ts'
import deleteArticle from '../handlers/articles/delete.ts'
import getThought from '../handlers/thoughts/get.ts'
import getThoughts from '../handlers/thoughts/getThoughts.ts'
import postThought from '../handlers/thoughts/post.ts'
import putThought from '../handlers/thoughts/put.ts'
import deleteThought from '../handlers/thoughts/delete.ts'
import getRandomThought from '../handlers/thoughts/getRandomThought.ts'
import postThoughtByTitle from '../handlers/thoughts/postThoughtByTitle.ts'
import putSelf from '../handlers/user/putSelf.ts'
import getVisits from '../handlers/test/getVisits.ts'
import deactivateUser from '../handlers/user/deactivateUser.ts'
import { deleteNote, getNote, getNotes, postNote, putNote } from '../handlers/notes.ts'
import { getCodeReviews, postCodeReview } from '../handlers/codeReviews.ts'
import { getThesis, putThesis, getThesisHistory } from '../handlers/thesis.ts'
import {
    deleteDwmWebhookDestination,
    getDwmWebhookDeliveries,
    getDwmWebhookDestinations,
    getDwmWebhookReceiverReceipts,
    postDwmWebhookDelivery,
    postDwmWebhookDestination,
    postDwmWebhookDestinationTest,
    postDwmWebhookReceiver,
    putDwmWebhookDestination,
} from '../handlers/dwm/webhooks.ts'

import type { FastifyInstance } from 'fastify'

export async function registerUserContentRoutes(fastify: FastifyInstance) {
    // User handlers
    fastify.get('/users', getUsers)
    fastify.get('/service-accounts/self', serviceAccountSelf)
    fastify.get('/service-accounts', getServiceAccounts)
    fastify.post('/service-accounts', postServiceAccount)
    fastify.patch('/service-accounts/:id', patchServiceAccount)
    fastify.delete('/service-accounts/:id', deleteServiceAccount)
    fastify.get('/user/:id/profile-stats', getProfileStats)
    fastify.get('/user/:id', getUser)
    fastify.get('/user/full/:id', authorizedUserHandler)
    fastify.put('/user/:id', putUser)
    fastify.put('/user/:id/active', deactivateUser)
    fastify.put('/user/self', putSelf)
    fastify.get('/user/self/ssh-keys', getProfileSshKeys)
    fastify.post('/user/self/ssh-keys', postProfileSshKey)
    fastify.delete('/user/self/ssh-keys/:id', deleteProfileSshKey)
    fastify.post('/user/restore', restoreSelf)
    fastify.delete('/user/:id', deleteUser)
    fastify.delete('/user/self', deleteSelf)

    // Pwned handler
    fastify.post('/pwned', postPwned)

    // DWM customer notifications
    fastify.get('/dwm/webhook-destinations', getDwmWebhookDestinations)
    fastify.post('/dwm/webhook-destinations', postDwmWebhookDestination)
    fastify.put('/dwm/webhook-destinations/:id', putDwmWebhookDestination)
    fastify.delete('/dwm/webhook-destinations/:id', deleteDwmWebhookDestination)
    fastify.post('/dwm/webhook-destinations/:id/test', postDwmWebhookDestinationTest)
    fastify.get('/dwm/webhook-deliveries', getDwmWebhookDeliveries)
    fastify.post('/dwm/webhook-deliveries', postDwmWebhookDelivery)
    fastify.get('/dwm/webhook-receiver', getDwmWebhookReceiverReceipts)
    fastify.post('/dwm/webhook-receiver', postDwmWebhookReceiver)

    // Article handlers
    fastify.get('/articles', getArticles)
    fastify.get('/article/:id', getArticle)
    fastify.post('/article/:id', postArticle)
    fastify.put('/article/:id', putArticle)
    fastify.delete('/article/:id', deleteArticle)

    // Test handlers
    fastify.get('/tests/recent', getRecentTests)
    fastify.get('/tests/mine', getMyRecentTests)
    fastify.get('/test/:id', getTest)
    fastify.get('/test/visits/:id', getVisits)
    fastify.post('/test', postTest)
    fastify.post('/test/:id/rerun', rerunTest)

    // Restart handler
    fastify.get('/restart/:id', restartHandler)

    // Thought handlers
    fastify.get('/thoughts', getThoughts)
    fastify.get('/thought/random', getRandomThought)
    fastify.get('/thought/:id', getThought)
    fastify.post('/thoughts', postThought)
    fastify.post('/thought/title', postThoughtByTitle)
    fastify.put('/thought/:id', putThought)
    fastify.delete('/thought/:id', deleteThought)

    // Notes
    fastify.get('/thesis/code-reviews', getCodeReviews)
    fastify.post('/thesis/code-reviews', { bodyLimit: 8192 }, postCodeReview)
    fastify.get('/thesis', getThesis)
    fastify.get('/thesis/history', getThesisHistory)
    fastify.get('/thesis/history/:revision', getThesisHistory)
    fastify.put('/thesis', { bodyLimit: 4_100_000 }, putThesis)
    fastify.get('/notes', getNotes)
    fastify.get('/notes/:id', getNote)
    fastify.post('/notes', postNote)
    fastify.put('/notes/:id', putNote)
    fastify.delete('/notes/:id', deleteNote)

}
