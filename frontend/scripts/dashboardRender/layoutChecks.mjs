export function inspectLayout(snapshot) {
    const reasons = []
    if (snapshot.narrowActionCount) reasons.push(`narrow vertical action controls: ${snapshot.narrowActionCount}`)
    if (snapshot.clippedTextCount) reasons.push(`clipped action/readiness text: ${snapshot.clippedTextCount}`)
    if (snapshot.overlapCount) reasons.push(`overlapping readiness/action controls: ${snapshot.overlapCount}`)
    return { reasons, overlapCount: snapshot.overlapCount, narrowActionCount: snapshot.narrowActionCount, clippedTextCount: snapshot.clippedTextCount }
}
