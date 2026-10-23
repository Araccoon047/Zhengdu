<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { settings } from '../settings'
import { contactById, contactDisplayName, primaryContact } from '../chat'
import { cropImage } from '../image-crop'
import LineGlyph from '../components/LineGlyph.vue'
import {
  addMomentComment,
  addUserMoment,
  deleteMoment,
  momentTime,
  momentsState,
  toggleUserFavorite,
  toggleUserLike,
} from '../moments'

const currentContact = computed(() => primaryContact())
const viewingContactId = ref('')
const viewedContact = computed(() => contactById(viewingContactId.value))
const isContactHome = computed(() => Boolean(viewedContact.value))
const draft = ref('')
const draftImages = ref([])
const composing = ref(false)
const publishing = ref(false)
const imageError = ref('')
const activeTab = ref('posts')
const activeCommentId = ref('')
const commentDraft = ref('')
const replyTargetComment = ref(null)
const settingsOpen = ref(false)
const clock = ref(0)
let clockTimer = null

const tabs = [
  { id: 'posts', label: '帖子' },
  { id: 'replies', label: '回复' },
  { id: 'favorites', label: '收藏' },
]

const profileName = computed(() =>
  isContactHome.value
    ? contactDisplayName(viewedContact.value)
    : settings.userName || '我'
)
const profileAvatarImage = computed(() =>
  isContactHome.value
    ? viewedContact.value?.avatarImage || ''
    : settings.anniversaryAvatarB || ''
)
const profileAvatarFrame = computed(() =>
  isContactHome.value
    ? viewedContact.value?.avatarFrame || ''
    : settings.userAvatarFrame || ''
)
const coverStyle = computed(() => {
  const cover = isContactHome.value
    ? viewedContact.value?.momentsCover || ''
    : settings.momentsBackground || ''
  if (!cover) return null
  return {
    backgroundImage: `url("${cover.replace(/"/g, '%22')}")`,
    opacity: 1,
  }
})
const favoritePosts = computed(() =>
  momentsState.posts.filter((post) => Boolean(post.favoriteByMe))
)

const displayedPosts = computed(() => {
  const target = viewedContact.value
  if (isContactHome.value && target) {
    if (activeTab.value === 'favorites') {
      return momentsState.posts.filter((post) =>
        [...(post.likes || []), ...(post.comments || [])].some((item) => item.contactId === target.id)
      )
    }
    if (activeTab.value === 'replies') {
      return momentsState.posts.filter((post) =>
        (post.comments || []).some((comment) => comment.contactId === target.id)
      )
    }
    return momentsState.posts.filter(
      (post) => post.authorType === 'contact' && post.authorId === target.id
    )
  }
  return activeTab.value === 'favorites' ? favoritePosts.value : momentsState.posts
})
const replyActivities = computed(() => {
  const activities = []
  for (const post of momentsState.posts) {
    if (!isContactHome.value && post.authorType !== 'me') continue
    for (const like of post.likes || []) {
      if (like.contactId === 'me') continue
      if (isContactHome.value && like.contactId !== viewedContact.value?.id) continue
      activities.push({
        id: `like-${post.id}-${like.contactId}`,
        type: 'like',
        name: like.name || 'TA',
        postText: postExcerpt(post.text),
        createdAt: post.createdAt,
        comment: '',
      })
    }
    for (const comment of post.comments || []) {
      if (comment.contactId === 'me') continue
      if (isContactHome.value && comment.contactId !== viewedContact.value?.id) continue
      activities.push({
        id: `comment-${comment.id}`,
        type: 'comment',
        name: comment.name || 'TA',
        postText: postExcerpt(post.text),
        createdAt: post.createdAt,
        comment: comment.text || '',
      })
    }
  }
  return activities.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
})

function postExcerpt(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  return clean.length > 46 ? `${clean.slice(0, 46)}…` : clean
}

function activityTime(createdAt) {
  const date = new Date(Number(createdAt) || Date.now())
  const now = new Date()
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const day = (value) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
  const diff = Math.floor((day(now) - day(date)) / 86400000)
  if (diff <= 0) return time
  if (diff === 1) return `昨天 ${time}`
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}
function timeLabel(createdAt) {
  clock.value
  return momentTime(createdAt)
}

function isLikedByMe(post) {
  return (post.likes || []).some((item) => item.contactId === 'me')
}

function openContactMoments(post) {
  if (post?.authorType !== 'contact' || !contactById(post.authorId)) return
  viewingContactId.value = post.authorId
  activeTab.value = 'posts'
  activeCommentId.value = ''
  composing.value = false
  document.querySelector('.site-main')?.scrollTo({ top: 0, behavior: 'smooth' })
}

function closeContactMoments() {
  viewingContactId.value = ''
  activeTab.value = 'posts'
  activeCommentId.value = ''
}
function toggleComposer() {
  composing.value = !composing.value
  imageError.value = ''
}

async function pickMomentImages(event) {
  const files = [...(event.target.files || [])].filter((file) => file.type.startsWith('image/'))
  event.target.value = ''
  if (!files.length) return
  imageError.value = ''
  for (const file of files) {
    if (draftImages.value.length >= 9) break
    try {
      const result = await cropImage(file, {
        title: '裁剪朋友圈照片',
        aspectRatio: 1,
        lockAspect: true,
        shape: 'rect',
        maxSide: 1600,
        quality: 0.84,
      })
      if (result) draftImages.value.push(result)
    } catch (e) {
      imageError.value = e.message || '图片处理失败'
    }
  }
}

function publishMoment() {
  if (publishing.value) return
  publishing.value = true
  const post = addUserMoment(draft.value, draftImages.value)
  if (post) {
    draft.value = ''
    draftImages.value = []
    composing.value = false
    activeTab.value = 'posts'
  }
  publishing.value = false
}

function removeDraftImage(index) {
  draftImages.value.splice(index, 1)
}

function toggleComment(post, comment = null) {
  if (activeCommentId.value === post.id && replyTargetComment.value?.id === comment?.id) {
    activeCommentId.value = ''
    replyTargetComment.value = null
    return
  }
  activeCommentId.value = post.id
  replyTargetComment.value = comment
  commentDraft.value = ''
}

function submitComment(post) {
  if (!addMomentComment(post.id, commentDraft.value, replyTargetComment.value)) return
  commentDraft.value = ''
  activeCommentId.value = ''
}

function activityAvatar() {
  return currentContact.value?.avatarImage || ''
}

function activityAvatarText(activity) {
  return currentContact.value?.avatar || activity.name?.slice(0, 1) || 'TA'
}

onMounted(() => {
  clockTimer = setInterval(() => {
    clock.value += 1
  }, 60000)
})

onUnmounted(() => {
  clearInterval(clockTimer)
})
</script>

<template>
  <section class="moments">
    <header class="profile-hero">
      <div class="profile-banner">
        <div v-if="coverStyle" class="profile-banner-image" :style="coverStyle"></div>
        <div class="profile-banner-wash"></div>
        <button v-if="isContactHome" class="contact-home-back" type="button" aria-label="返回朋友圈" @click="closeContactMoments"><LineGlyph type="back" /></button>
        <span class="profile-avatar">
          <img v-if="profileAvatarImage" :src="profileAvatarImage" alt="" />
          <template v-else>{{ profileName.slice(0, 1) }}</template>
          <img
            v-if="profileAvatarFrame"
            class="profile-avatar-frame"
            :src="profileAvatarFrame"
            alt=""
          />
        </span>
      </div>

      <div class="profile-info">
        <h2>{{ profileName }}</h2>
        
      </div>

      <div v-if="!isContactHome" class="profile-actions">
        <button class="profile-button primary" type="button" @click="toggleComposer">
          {{ composing ? '收起' : '发帖' }}
        </button>
        <button class="profile-button" type="button" @click="settingsOpen = true">设置</button>
      </div>
    </header>

    <transition name="compose-slide">
      <section v-if="composing && !isContactHome" class="compose-panel">
        <div class="compose-heading">
          <strong>发表朋友圈</strong>
          <button type="button" aria-label="关闭发布区" @click="toggleComposer">×</button>
        </div>
        <textarea
          v-model="draft"
          rows="4"
          maxlength="500"
          placeholder="这一刻的想法…"
        ></textarea>
        <div v-if="draftImages.length" class="compose-images">
          <span v-for="(image, index) in draftImages" :key="index" class="compose-image">
            <img :src="image" alt="" />
            <button type="button" aria-label="移除照片" @click="removeDraftImage(index)">×</button>
          </span>
        </div>
        <div class="compose-footer">
          <label class="photo-button">
            照片
            <input type="file" accept="image/*" multiple @change="pickMomentImages" />
          </label>
          <button
            class="publish-button"
            type="button"
            :disabled="(!draft.trim() && !draftImages.length) || publishing"
            @click="publishMoment"
          >
            发表
          </button>
        </div>
        <div v-if="imageError" class="image-error">{{ imageError }}</div>
      </section>
    </transition>

    <nav class="tab-bar" aria-label="朋友圈内容分类">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="tab-item"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div v-if="activeTab === 'replies'" class="panel reply-panel">
      <article v-for="activity in replyActivities" :key="activity.id" class="activity-item">
        <span class="activity-avatar">
          <img v-if="activityAvatar()" :src="activityAvatar()" alt="" />
          <template v-else>{{ activityAvatarText(activity) }}</template>
        </span>
        <div class="activity-main">
          <p class="activity-text">
            <strong>{{ activity.name }}</strong>
            {{ activity.type === 'like' ? '点赞了你的朋友圈' : '评论了你的朋友圈' }}
          </p>
          <p v-if="activity.postText" class="activity-excerpt">{{ activity.postText }}</p>
          <div v-if="activity.comment" class="activity-comment">{{ activity.comment }}</div>
        </div>
        <time class="activity-time">{{ activityTime(activity.createdAt) }}</time>
      </article>

      <div v-if="!replyActivities.length" class="moments-empty">
        <div class="empty-mark">◌</div>
        <strong>还没有新的回复</strong>
        <span>联系人的点赞和评论会出现在这里。</span>
      </div>
    </div>

    <div v-else class="panel post-panel">
      <article v-for="post in displayedPosts" :key="post.id" class="post-card">
        <header class="post-header">
          <span class="post-avatar" :class="{ clickable: post.authorType === 'contact' }" @click.stop="openContactMoments(post)" :style="{ background: post.authorColor || 'var(--theme-primary)' }">
            <img v-if="post.authorAvatarImage" :src="post.authorAvatarImage" alt="" />
            <template v-else>{{ post.authorAvatar || 'TA' }}</template>
            <img
              v-if="post.authorAvatarFrame"
              class="post-avatar-frame"
              :src="post.authorAvatarFrame"
              alt=""
            />
          </span>
          <div class="post-author-copy">
            <strong>{{ post.authorName }}</strong>
            <time>{{ timeLabel(post.createdAt) }}</time>
          </div>
        </header>

        <p v-if="post.text" class="post-content">{{ post.text }}</p>

        <div
          v-if="post.images?.length"
          class="post-images"
          :class="{ single: post.images.length === 1 }"
        >
          <img v-for="(image, index) in post.images" :key="index" :src="image" alt="" />
        </div>

        <div class="post-actions">
          <button
            class="action-item"
            type="button"
            aria-label="评论"
            @click="toggleComment(post)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <span>{{ post.comments?.length || 0 }}</span>
          </button>
          <button
            class="action-item"
            :class="{ active: isLikedByMe(post) }"
            type="button"
            aria-label="点赞"
            @click="toggleUserLike(post.id)"
          >
            <svg
              viewBox="0 0 24 24"
              :fill="isLikedByMe(post) ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="1.9"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>{{ post.likes?.length || 0 }}</span>
          </button>
          <button
            class="action-item"
            :class="{ active: post.favoriteByMe }"
            type="button"
            aria-label="收藏"
            @click="toggleUserFavorite(post.id)"
          >
            <svg
              viewBox="0 0 24 24"
              :fill="post.favoriteByMe ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="1.9"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span>{{ post.favoriteByMe ? '已收藏' : '收藏' }}</span>
          </button>
          <button
            v-if="post.authorType === 'me'"
            class="action-item delete-action"
            type="button"
            aria-label="删除"
            @click="deleteMoment(post.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
              <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
            </svg>
            <span>删除</span>
          </button>
        </div>

        <form
          v-if="activeCommentId === post.id"
          class="comment-compose"
          @submit.prevent="submitComment(post)"
        >
          <input v-model="commentDraft" type="text" maxlength="100" :placeholder="replyTargetComment ? `回复 ${replyTargetComment.name}…` : '写下评论…'" />
          <button type="submit" :disabled="!commentDraft.trim()">发送</button>
        </form>

        <div v-if="post.likes?.length || post.comments?.length" class="moment-social">
          <div v-if="post.likes?.length" class="like-line">
            <span>♥</span>{{ post.likes.map((item) => item.name).join('、') }}
          </div>
          <div v-for="comment in post.comments" :key="comment.id" class="comment-line" @click.stop="toggleComment(post, comment)">
            <strong>{{ comment.name }}：</strong><span v-if="comment.replyToName">回复 {{ comment.replyToName }}：</span>{{ comment.text }}

          </div>
        </div>
      </article>

      <div v-if="!displayedPosts.length" class="moments-empty">
        <div class="empty-mark">◌</div>
        <strong>{{ activeTab === 'favorites' ? '还没有收藏内容' : '朋友圈还没有内容' }}</strong>
        <span>
          {{ activeTab === 'favorites' ? '点击动态下方的收藏图标，就会出现在这里。' : '点击上方“发帖”，或等待 TA 随机发布。' }}
        </span>
      </div>
    </div>

    <teleport to="body">
      <transition name="settings-pop">
        <div
          v-if="settingsOpen"
          class="moments-settings-layer"
          role="presentation"
          @click.self="settingsOpen = false"
        >
          <section class="moments-settings-card" role="dialog" aria-modal="true" aria-label="朋友圈设置">
            <header>
              <div>
                <strong>朋友圈设置</strong>
                <span>管理联系人之间的互动方式</span>
              </div>
              <button type="button" aria-label="关闭设置" @click="settingsOpen = false">×</button>
            </header>

            <label class="settings-toggle-row">
              <span class="settings-toggle-copy">
                <strong>允许其他联系人互相评论</strong>
                <small>开启后，联系人可以对彼此发布的动态随机点赞或评论。</small>
              </span>
              <input v-model="settings.allowContactsMutualComments" type="checkbox" />
            </label>
          </section>
        </div>
      </transition>
    </teleport>  </section>
</template>


<style scoped>
.moments {
  width: 100%;
  max-width: none;
  min-height: 100%;
  margin: 0;
  padding-bottom: 24px;
  border: 0;
  border-radius: 0;
  overflow: hidden;
  background-color: #ffffff;
  color: var(--theme-text-strong);
  box-shadow: none;
}

.profile-hero {
  position: relative;
  background: #ffffff;
}

.profile-banner {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: visible;
  background: var(--theme-primary);
}

.contact-home-back {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 4;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  background: rgba(20, 46, 72, 0.3);
  color: #ffffff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
.profile-banner-image {
  position: absolute;
  inset: 0;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
}

.profile-banner-wash {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 55%, rgba(var(--theme-overlay-rgb), 0.14));
}

.profile-avatar {
  position: absolute;
  bottom: -54px;
  left: 24px;
  z-index: 2;
  width: 108px;
  height: 108px;
  border: 4px solid #ffffff;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: visible;
  background: var(--theme-primary-light);
  color: #ffffff;
  font-size: 30px;
  font-weight: 800;
  box-shadow: 0 8px 24px rgba(var(--theme-overlay-rgb), 0.2);
}

.profile-avatar > img:first-child {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.profile-avatar-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 118%;
  height: 118%;
  max-width: none;
  object-fit: contain;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.profile-info {
  padding: 64px 20px 16px;
}

.profile-info h2 {
  margin: 0 0 8px;
  color: var(--theme-text-strong);
  font-size: 27px;
  font-weight: 800;
  line-height: 1.2;
}

.profile-info p {
  margin: 0;
  color: var(--theme-text);
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.profile-actions {
  display: flex;
  gap: 12px;
  padding: 0 20px 20px;
}

.profile-button {
  flex: 1;
  min-height: 43px;
  padding: 10px 14px;
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: #ffffff;
  color: var(--theme-primary);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.profile-button.primary {
  border-color: var(--theme-primary);
  background: var(--theme-primary);
  color: #ffffff;
}

.compose-panel {
  margin: 0 16px 16px;
  padding: 14px;
  border: 1px solid var(--theme-border);
  border-radius: 16px;
  background: var(--theme-surface);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.compose-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.compose-heading strong {
  color: var(--theme-primary);
  font-size: 13px;
  font-weight: 800;
}

.compose-heading button {
  width: 28px;
  height: 28px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: #ffffff;
  color: var(--theme-primary);
  font-size: 17px;
  cursor: pointer;
}

.compose-panel textarea {
  width: 100%;
  min-height: 100px;
  padding: 11px;
  border: 1px solid var(--theme-border);
  border-radius: 12px;
  background: #ffffff;
  color: #333333;
  font-size: 13px;
  line-height: 1.65;
  resize: vertical;
}

.compose-images,
.post-images {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.compose-image {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--theme-bg-tint);
}

.compose-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.compose-image button {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: rgba(var(--theme-overlay-rgb), 0.72);
  color: #ffffff;
  cursor: pointer;
}

.compose-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.photo-button,
.publish-button {
  padding: 8px 14px;
  border: 1px solid var(--theme-border);
  border-radius: 999px;
  background: #ffffff;
  color: var(--theme-primary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.photo-button input {
  display: none;
}

.publish-button {
  border-color: var(--theme-primary);
  background: var(--theme-primary);
  color: #ffffff;
}

.publish-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.image-error {
  color: var(--theme-accent-warm);
  font-size: 10.5px;
}

.tab-bar {
  display: flex;
  border: 1px solid var(--theme-border-soft);
  border-radius: 0;
  background: transparent;
}

.tab-item {
  position: relative;
  flex: 1;
  padding: 14px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--theme-muted);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.tab-item.active {
  color: var(--theme-primary);
}

.tab-item.active::after { display: none; }

.panel {
  min-height: 260px;
  padding: 0 16px 22px;
  background: #ffffff;
}

.post-card {
  padding: 18px 0;
  border-bottom: 1px solid var(--theme-border-soft);
}

.post-card:last-child {
  border-bottom: 0;
}

.post-header {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 11px;
}

.post-avatar,
.activity-avatar {
  position: relative;
  flex: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: visible;
  color: #ffffff;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(var(--theme-primary-rgb), 0.16);
}

.post-avatar.clickable {
  cursor: pointer;
}

.post-avatar {
  width: 44px;
  height: 44px;
  font-size: 14px;
}

.activity-avatar {
  width: 36px;
  height: 36px;
  font-size: 12px;
}

.post-avatar > img:first-child,
.activity-avatar > img:first-child {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.post-avatar-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 116%;
  height: 116%;
  max-width: none;
  object-fit: contain;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.post-author-copy {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.post-author-copy strong {
  color: var(--theme-text-strong);
  font-size: 14px;
  font-weight: 800;
}

.post-author-copy time {
  color: var(--theme-muted);
  font-size: 11px;
}

.post-content {
  margin: 0 0 14px;
  color: var(--theme-text-strong);
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.post-images {
  width: min(100%, 400px);
  margin: 0 0 14px;
}

.post-images.single {
  width: min(72%, 260px);
  grid-template-columns: 1fr;
}

.post-images img {
  width: 100%;
  aspect-ratio: 1;
  display: block;
  border-radius: 7px;
  object-fit: cover;
}

.post-actions {
  display: flex;
  align-items: center;
  gap: 22px;
}

.action-item {
  padding: 0;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--theme-text);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  cursor: pointer;
  appearance: none;
}

.action-item svg {
  width: 18px;
  height: 18px;
}

.action-item.active {
  color: var(--theme-primary);
}

.action-item.delete-action {
  color: var(--theme-accent-warm);
}

.comment-compose {
  margin-top: 11px;
  display: flex;
  gap: 7px;
}

.comment-compose input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--theme-border);
  border-radius: 9px;
  background: var(--theme-surface);
  color: var(--theme-text-strong);
  font-size: 11px;
}

.comment-compose button {
  padding: 7px 4px;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--theme-primary);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  appearance: none;
}

.comment-compose button:disabled {
  opacity: 0.45;
  cursor: default;
}

.moment-social {
  margin-top: 10px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--theme-text);
  font-size: 11px;
  line-height: 1.55;
}

.like-line {
  color: var(--theme-primary);
  font-weight: 700;
}

.like-line span {
  margin-right: 4px;
  color: var(--theme-accent-warm);
}

.comment-line {
  margin-top: 4px;
}

.comment-line strong {
  color: var(--theme-primary);
}

.activity-item {
  padding: 15px 0;
  border-bottom: 1px solid var(--theme-border-soft);
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.activity-main {
  flex: 1;
  min-width: 0;
}

.activity-text {
  margin: 0;
  color: var(--theme-text-strong);
  font-size: 13px;
  line-height: 1.55;
}

.activity-text strong {
  color: var(--theme-primary);
}

.activity-excerpt {
  margin: 4px 0 0;
  color: var(--theme-muted);
  font-size: 11px;
  line-height: 1.5;
}

.activity-comment {
  margin-top: 7px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--theme-text);
  font-size: 11.5px;
  line-height: 1.55;
}

.moments-empty {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--theme-muted);
  text-align: center;
}

.moments-empty strong {
  color: var(--theme-accent);
  font-size: 13px;
}

.moments-empty span {
  max-width: 260px;
  font-size: 10.5px;
  line-height: 1.55;
}

.empty-mark {
  font-size: 46px;
  line-height: 1;
}

.compose-slide-enter-active,
.compose-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.compose-slide-enter-from,
.compose-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 560px) {
  .profile-avatar {
    bottom: -49px;
    left: 20px;
    width: 98px;
    height: 98px;
    font-size: 27px;
  }

  .profile-info {
    padding: 56px 18px 14px;
  }

  .profile-info h2 {
    font-size: 25px;
  }

  .profile-actions {
    padding: 0 18px 18px;
  }

  .panel {
    padding-right: 18px;
    padding-left: 18px;
  }
}

.moments-settings-layer {
  position: fixed;
  inset: 0;
  z-index: 280;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(var(--theme-overlay-rgb), 0.34);
  -webkit-backdrop-filter: blur(7px);
  backdrop-filter: blur(7px);
}

.moments-settings-card {
  width: min(340px, 100%);
  padding: 16px;
  border: 1px solid var(--theme-border);
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 22px 56px rgba(var(--theme-overlay-rgb), 0.25);
}

.moments-settings-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--theme-border-soft);
}

.moments-settings-card header > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.moments-settings-card header strong {
  color: var(--theme-text-strong);
  font-size: 14px;
  font-weight: 800;
}

.moments-settings-card header span {
  color: var(--theme-muted);
  font-size: 10px;
}

.moments-settings-card header button {
  flex: none;
  width: 29px;
  height: 29px;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-surface);
  color: var(--theme-primary);
  font-size: 18px;
  cursor: pointer;
}

.settings-toggle-row {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.settings-toggle-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-toggle-copy strong {
  color: var(--theme-text-strong);
  font-size: 12px;
  font-weight: 800;
}

.settings-toggle-copy small {
  color: var(--theme-muted);
  font-size: 8.5px;
  line-height: 1.5;
}

.settings-toggle-row input {
  position: relative;
  flex: none;
  width: 42px;
  height: 24px;
  margin: 0;
  border: 0;
  border-radius: 999px;
  appearance: none;
  background: var(--theme-border);
  cursor: pointer;
  transition: background 0.18s ease;
}

.settings-toggle-row input::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(var(--theme-overlay-rgb), 0.2);
  transition: transform 0.18s ease;
}

.settings-toggle-row input:checked {
  background: var(--theme-primary);
}

.settings-toggle-row input:checked::after {
  transform: translateX(18px);
}

.settings-pop-enter-active,
.settings-pop-leave-active {
  transition: opacity 0.18s ease;
}

.settings-pop-enter-active .moments-settings-card,
.settings-pop-leave-active .moments-settings-card {
  transition: transform 0.18s ease;
}

.settings-pop-enter-from,
.settings-pop-leave-to {
  opacity: 0;
}

.settings-pop-enter-from .moments-settings-card,
.settings-pop-leave-to .moments-settings-card {
  transform: translateY(8px) scale(0.98);
}

.contact-home-back{border:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;display:grid!important;place-items:center!important}
.contact-home-back svg{width:22px;height:22px;display:block}
.activity-time{flex:none;margin-left:auto;color:var(--theme-muted);font-size:9.5px;white-space:nowrap}
.comment-line{display:flex;align-items:flex-start;gap:4px;flex-wrap:wrap}
.comment-reply-button{padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;color:var(--theme-primary);font-size:10px;cursor:pointer}
.moment-social{border-top:2px solid #111!important;padding-top:10px!important}
.comment-line{padding:7px 8px!important;border:0!important;border-radius:0!important;background:var(--theme-surface)!important;box-shadow:none!important;cursor:pointer}
.comment-line + .comment-line{margin-top:6px}</style>
