use super::*;

#[test]
fn search_history_is_bounded_retained_and_read_only() {
    let root = std::env::temp_dir().join(format!("fyflate-search-test-{}-{}", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
    let folder = root.join("twitch").join("fixture");
    fs::create_dir_all(&folder).unwrap();
    let file = folder.join("recent_chat.log");
    let now = CHAT_HISTORY_DEFAULT_MAX_AGE_MS * 2;
    let chat = |id: &str| format!(r#"{{"id":"{id}","kind":"chat","text":"hello","username":"Panda"}}"#);
    let content = format!("{}\t{}\n{}\t{}\n{}\t{}\n{}\t{}\n{}\t{}\n{}\t{{\"kind\":\"system\"}}\ninvalid\n",
        now - CHAT_HISTORY_DEFAULT_MAX_AGE_MS - 1, chat("expired"), now - 3, chat("older"), now - 2, chat("second"), now - 1, chat("newest"), now + 1, chat("future"), now);
    fs::write(&file, &content).unwrap();
    let results = collect_search_history(&root, now, 2, None).unwrap();
    assert_eq!(results.len(), 2);
    assert!(results[0].payload_json.contains("newest"));
    assert!(results[1].payload_json.contains("second"));
    assert_eq!(results[0].platform, "twitch");
    assert_eq!(results[0].channel, "fixture");
    assert_eq!(fs::read_to_string(&file).unwrap(), content, "search must not rewrite existing chat history");
    assert!(collect_search_history(&root, now + CHAT_HISTORY_DEFAULT_MAX_AGE_MS + 2, 5000, None).unwrap().is_empty());
    assert_eq!(collect_search_history(&root, now, 5000, Some(0)).unwrap().len(), 4, "unlimited retention keeps older valid chat rows");
    fs::remove_file(file).unwrap();
    fs::remove_dir(&folder).unwrap();
    fs::remove_dir(root.join("twitch")).unwrap();
    fs::remove_dir(root).unwrap();
}
