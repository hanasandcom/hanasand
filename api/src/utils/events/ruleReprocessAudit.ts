import type run from '#db'
import { identityQueryOnce } from '#db'

export async function recordReprocessCompletion(jobId: string, query: typeof run) {
    const eventId = (await identityQueryOnce('SELECT nextval(pg_get_serial_sequence(\'public.system_events\',\'id\')) AS id')).rows[0]?.id
    if (!eventId) throw new Error('Identity system event ID sequence is unavailable.')
    await query(`INSERT INTO system_events(id,event_type,severity,source,service,actor_id,object_type,object_id,organization_id,
        subject_id,request_id,outcome,reason,context,ip,user_agent,created_at)
        SELECT $1,'event.rule.reprocessed','info','event','hanasand-api',NULL,'event_rule',rule_id,organization_id,
            NULL,NULL,'success','',jsonb_build_object('jobId',id,'version',rule_version,'scanned',scanned,'matched',matched,
                'protected',protected,'removedEvents',removed_events,'removedSources',removed_sources),'','',NOW()
        FROM rule_reprocess_jobs WHERE id=$2`, [eventId, jobId])
}
