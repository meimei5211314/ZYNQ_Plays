/* C11 single-producer/single-consumer ring. See ../README.md for assumptions.
 * The default main is a self-check; define SPSC_NO_MAIN for object integration.
 */
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdatomic.h>

#ifndef SPSC_DEPTH
#define SPSC_DEPTH 8u
#endif

_Static_assert(SPSC_DEPTH >= 2u, "one ring slot is reserved; depth must be >= 2");

typedef struct {
    _Atomic size_t head; /* producer owns writes */
    _Atomic size_t tail; /* consumer owns writes */
    uint32_t items[SPSC_DEPTH];
} spsc_queue;

void spsc_init(spsc_queue *queue);
bool spsc_push(spsc_queue *queue, uint32_t value);
bool spsc_pop(spsc_queue *queue, uint32_t *value);

static size_t next_index(size_t index)
{
    return index + 1u == SPSC_DEPTH ? 0u : index + 1u;
}

void spsc_init(spsc_queue *queue)
{
    /* Initialize before publishing the queue to either participant. */
    atomic_init(&queue->head, 0u);
    atomic_init(&queue->tail, 0u);
}

bool spsc_push(spsc_queue *queue, uint32_t value)
{
    const size_t head = atomic_load_explicit(&queue->head, memory_order_relaxed);
    const size_t next = next_index(head);
    /* Acquire pairs with consumer's release: do not reuse an unread slot. */
    if (next == atomic_load_explicit(&queue->tail, memory_order_acquire)) {
        return false;
    }
    queue->items[head] = value;
    /* Publish data before the new head becomes visible to the consumer. */
    atomic_store_explicit(&queue->head, next, memory_order_release);
    return true;
}

bool spsc_pop(spsc_queue *queue, uint32_t *value)
{
    const size_t tail = atomic_load_explicit(&queue->tail, memory_order_relaxed);
    /* Acquire pairs with producer's release: the published item is ready. */
    if (tail == atomic_load_explicit(&queue->head, memory_order_acquire)) {
        return false;
    }
    *value = queue->items[tail];
    /* Release completes the read before producer can reuse this slot. */
    atomic_store_explicit(&queue->tail, next_index(tail), memory_order_release);
    return true;
}

#ifndef SPSC_NO_MAIN
#include <inttypes.h>
#include <stdio.h>

/* These checks still execute with -DNDEBUG. */
#define CHECK(condition) do { \
    if (!(condition)) { \
        fprintf(stderr, "FAIL line %d: %s\n", __LINE__, #condition); \
        return 1; \
    } \
} while (0)

int main(void)
{
    spsc_queue queue;
    uint32_t value = UINT32_C(0xDEADBEEF);
    spsc_init(&queue);

    CHECK(!spsc_pop(&queue, &value));
    CHECK(value == UINT32_C(0xDEADBEEF));
    for (size_t i = 0; i < SPSC_DEPTH - 1u; ++i) {
        CHECK(spsc_push(&queue, (uint32_t)i));
    }
    CHECK(!spsc_push(&queue, UINT32_C(0xBAD)));
    for (size_t i = 0; i < SPSC_DEPTH - 1u; ++i) {
        CHECK(spsc_pop(&queue, &value));
        CHECK(value == (uint32_t)i);
    }
    CHECK(!spsc_pop(&queue, &value));

    /* Many wraps with a live backlog, both full and empty transitions. */
    uint32_t produced = 0;
    uint32_t consumed = 0;
    while (consumed < UINT32_C(100000)) {
        while (produced < UINT32_C(100000) && spsc_push(&queue, produced)) {
            ++produced;
        }
        CHECK(spsc_pop(&queue, &value));
        CHECK(value == consumed);
        ++consumed;
    }
    CHECK(produced == consumed);
    CHECK(!spsc_pop(&queue, &value));
    printf("PASS spsc: capacity=%zu, ordered=%" PRIu32
           ", head_lock_free=%d, tail_lock_free=%d\n",
           (size_t)SPSC_DEPTH - 1u, consumed,
           (int)atomic_is_lock_free(&queue.head),
           (int)atomic_is_lock_free(&queue.tail));
    return 0;
}
#endif
